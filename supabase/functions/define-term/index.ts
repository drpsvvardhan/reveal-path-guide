// Phase B v2 — witness-bound Patient Reveal definition resolver.
//
// The hover is a view of the resolver, not a parallel system. Concepts
// are primary; surface forms are views over concepts. The resolver may
// explain any medical term, but it may only NAME Vizzhy concepts from
// ALLOWED_VIZZHY_CONCEPTS. Anything outside the allowed list gets a
// plain biological explanation and vizzhy_concept_mapped = false.

import {
  ALLOWED_VIZZHY_CONCEPTS,
  DEFINE_TERM_SYSTEM_PROMPT,
} from "./system_prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tiny server-side memo (term + state hash → response, 24h TTL).
const cache = new Map<string, { payload: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const MODEL_ID = "google/gemini-2.5-flash";

interface DefinitionContextLike {
  // Loose shape — we don't reconstruct the type from the client; we
  // just stringify it for the LLM. Keeping it loose avoids drift if the
  // client adds fields.
  [k: string]: unknown;
}

interface RequestBody {
  term?: string;
  sentence?: string;
  section_context?: string;
  patient_id?: string | null;
  definition_context?: DefinitionContextLike | null;
}

interface ResponsePayload {
  definition: string;
  grounding: string | null;
  citations: Array<{ field: string; value: string }> | null;
  vizzhy_concept_mapped: boolean;
  cache_key: string;
  trace: {
    model: string;
    fields_consulted: string[];
    fallback_reason?: string;
    ontology_leakage_detected?: boolean;
    ontology_leakage_terms?: string[];
  };
}

const ALLOWED_SET = new Set(ALLOWED_VIZZHY_CONCEPTS.map((c) => c.toLowerCase()));

const LEAKAGE_SUFFIX_RE =
  /\b([A-Z][a-zA-Z]+(?:\s+[A-Za-z]+){0,3}\s+(?:Index|Score|Mode|Zone|Gate|Axis|Pattern|Intelligence|Resilience|Vitality))\b/g;

const LEAKAGE_VIZZHY_READS_RE =
  /\bVizzhy\s+reads?\s+([a-zA-Z][a-zA-Z\s\-]{2,40})\s+as\b/gi;

function detectOntologyLeakage(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  let m: RegExpExecArray | null;

  LEAKAGE_SUFFIX_RE.lastIndex = 0;
  while ((m = LEAKAGE_SUFFIX_RE.exec(text))) {
    const phrase = m[1].trim();
    if (!ALLOWED_SET.has(phrase.toLowerCase())) found.push(phrase);
  }

  LEAKAGE_VIZZHY_READS_RE.lastIndex = 0;
  while ((m = LEAKAGE_VIZZHY_READS_RE.exec(text))) {
    const ref = m[1].trim().toLowerCase();
    // If the noun referenced isn't an allowed concept, flag it.
    if (!Array.from(ALLOWED_SET).some((c) => ref.includes(c))) {
      found.push(m[0].trim());
    }
  }

  // Dedup
  return Array.from(new Set(found));
}

function isMappedTerm(term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  if (ALLOWED_SET.has(t)) return true;
  // simple plural strip
  if (t.endsWith("s") && ALLOWED_SET.has(t.slice(0, -1))) return true;
  return false;
}

function shortHash(s: string): string {
  // FNV-1a 32-bit, hex. Stable, no deps.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function buildCacheKey(term: string, defCtx: unknown, patientId: string | null): string {
  const stateHash = shortHash(JSON.stringify(defCtx ?? {}));
  const norm = term.toLowerCase().trim();
  return `${norm}:${patientId ?? "anon"}:${stateHash}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const term = (body.term || "").trim();
    const sentence = (body.sentence || "").trim();

    if (!term) {
      return new Response(
        JSON.stringify({ error: "term is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sectionContext = (body.section_context || "").slice(0, 800);
    const patientId = body.patient_id ?? null;
    const defCtx = body.definition_context ?? null;
    const cacheKey = buildCacheKey(term, defCtx, patientId);

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return new Response(JSON.stringify(cached.payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userMessage = [
      `Hovered term: ${term}`,
      sentence ? `Containing sentence: ${sentence}` : "",
      sectionContext ? `Surrounding context: ${sectionContext}` : "",
      `DefinitionContext (patient state, may contain nulls): ${JSON.stringify(defCtx ?? {})}`,
      `Cache key (echo this back verbatim in response.cache_key): ${cacheKey}`,
    ].filter(Boolean).join("\n\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: DEFINE_TERM_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Definition service unavailable" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await aiResponse.json();
    const raw = result.choices?.[0]?.message?.content || "";

    let parsed: Partial<ResponsePayload> = {};
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("define-term: failed to parse model JSON", e, raw);
      parsed = {
        definition: typeof raw === "string" && raw ? raw : "Could not load definition.",
        grounding: null,
        citations: null,
        vizzhy_concept_mapped: isMappedTerm(term),
        cache_key: cacheKey,
        trace: { model: MODEL_ID, fields_consulted: [], fallback_reason: "model_returned_invalid_json" },
      };
    }

    // Normalize / enforce shape.
    const definition = (parsed.definition || "Could not load definition.").trim();
    const grounding = parsed.grounding ?? null;
    const citations = parsed.citations ?? null;
    const vizzhyMapped = typeof parsed.vizzhy_concept_mapped === "boolean"
      ? parsed.vizzhy_concept_mapped
      : isMappedTerm(term);

    const trace = {
      model: MODEL_ID,
      fields_consulted: Array.isArray(parsed.trace?.fields_consulted)
        ? parsed.trace!.fields_consulted
        : [],
      ...(parsed.trace?.fallback_reason ? { fallback_reason: parsed.trace.fallback_reason } : {}),
    } as ResponsePayload["trace"];

    // Ontology leakage guard — non-blocking, server-logged.
    const leakage = detectOntologyLeakage(`${definition}\n${grounding ?? ""}`);
    if (leakage.length > 0) {
      trace.ontology_leakage_detected = true;
      trace.ontology_leakage_terms = leakage;
      console.warn("define-term: ontology leakage detected", { term, leakage });
    }

    const payload: ResponsePayload = {
      definition,
      grounding,
      citations,
      vizzhy_concept_mapped: vizzhyMapped,
      cache_key: cacheKey,
      trace,
    };

    cache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    if (cache.size > 500) {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (v.expiresAt < now) cache.delete(k);
      }
    }

    return new Response(JSON.stringify(payload), {
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