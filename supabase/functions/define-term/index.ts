// Using built-in Deno.serve (no remote std import) — std@0.168.0 was returning 500 from the bundler.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory cache (term+sentence hash → definition, 24h TTL)
const cache = new Map<string, { definition: string; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(term: string, sentence: string): string {
  // Simple hash: lowercase term + first 200 chars of sentence
  return `${term.toLowerCase().trim()}::${sentence.slice(0, 200).toLowerCase().trim()}`;
}

const SYSTEM_PROMPT = `You are Vizzhy's inline definition layer. A patient reading their personal terrain portrait has tapped a word they don't recognize. Your job is to explain that word in exactly one sentence, in the context of the sentence they're reading, in the Vizzhy voice.

Rules:
- One sentence. Under 30 words.
- Respect the reader. They are intelligent adults, not children. Use the real concept.
- Match the voice of the surrounding text — if the sentence is clinical, be clinical. If it's warm, be warm. Never wellness-app vocabulary. Never condescension.
- If the word has multiple meanings, pick the one that fits the sentence they're reading.
- No preamble. No 'the term X means...' — just the definition itself, phrased as a clean single sentence.
- If the word is not a biological or clinical concept (e.g. a common word the patient tapped by accident), return exactly: 'This is a common word — no technical meaning in this context.'
- When the tapped word is load-bearing for the sentence's meaning, let the definition echo why the word was chosen for that sentence. A word that carries thesis should be defined in a way that carries the same thesis. Do not provide a neutral dictionary gloss for words where Vizzhy is using the word in a specific, intentional way. Examples of load-bearing words that should receive thesis-carrying definitions: biology, terrain, trajectory, pattern, state, system, memory, momentum, rhythm, coherence, resilience, reserve, signal, load. When these words appear in Vizzhy prose, they are being used intentionally — define them the way Vizzhy is using them, not the way a textbook would.

Return JSON: { "definition": "string" }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { term, sentence, section_context } = await req.json();

    if (!term || !sentence) {
      return new Response(
        JSON.stringify({ error: "term and sentence are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache
    const key = cacheKey(term, sentence);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return new Response(JSON.stringify({ definition: cached.definition }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const userMessage = `Term: ${term}\nSentence: ${sentence}\nSection: ${(section_context || "").slice(0, 500)}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Definition service unavailable" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || "";

    // Try to parse JSON from response — handle markdown-wrapped JSON
    let definition: string;
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      definition = parsed.definition || cleaned;
    } catch {
      // If not JSON, use raw text
      definition = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    }

    // Cache it
    cache.set(key, { definition, expiresAt: Date.now() + CACHE_TTL_MS });

    // Prune expired entries occasionally
    if (cache.size > 500) {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (v.expiresAt < now) cache.delete(k);
      }
    }

    return new Response(JSON.stringify({ definition }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("define-term error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
