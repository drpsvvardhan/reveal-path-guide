import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a compassionate, knowledgeable patient care reasoning assistant for the Vizzhy PatientOS platform. You help patients understand their health data, lab results, and care plans in clear, warm, non-clinical language.

IMPORTANT RULES:
- Always respond in three clearly labeled sections using markdown bold headers:
  **What this means** — explain the concept in plain language
  **What you can do** — give practical, actionable guidance
  **What to ask your doctor** — suggest specific questions for their care team
- Be empathetic, precise, and never dismissive
- Never diagnose or prescribe — always frame as guidance to discuss with their care team
- Reference the patient's specific data when relevant
- If you're unsure about something, say so honestly`;

function buildSystemPrompt(patientContext?: string, documents?: any[]): string {
  let prompt = SYSTEM_PROMPT;
  if (patientContext) {
    prompt += `\n\nPATIENT CONTEXT:\n${patientContext}`;
  }
  if (documents?.length) {
    prompt += `\n\nPATIENT MEDICAL DOCUMENTS:\nThe patient has uploaded the following medical records. Use this information to provide more specific, personalized guidance:\n`;
    for (const doc of documents) {
      prompt += `\n--- Document: ${doc.name} (${doc.type}) ---\n${doc.content}\n`;
    }
  }
  return prompt;
}

async function handleAnthropicStream(messages: any[], systemPrompt: string) {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic error:", response.status, errText);
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Anthropic API error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Transform Anthropic SSE stream to OpenAI-compatible SSE format
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "content_block_delta" && event.delta?.text) {
              // Convert to OpenAI-compatible format
              const openaiChunk = {
                choices: [{ delta: { content: event.delta.text } }],
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
            } else if (event.type === "message_stop") {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            }
          } catch { /* skip unparseable */ }
        }
      }
    },
  });

  const transformed = response.body!.pipeThrough(transformStream);
  return new Response(transformed, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

async function handleLovableStream(messages: any[], systemPrompt: string, model: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const t = await response.text();
    console.error("AI gateway error:", response.status, t);
    return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(response.body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, patientContext, documents, model } = await req.json();
    const systemPrompt = buildSystemPrompt(patientContext, documents);

    // Route to Anthropic if Claude model requested
    if (model?.startsWith("claude")) {
      return await handleAnthropicStream(messages, systemPrompt);
    }

    // Default to Lovable AI Gateway
    const gatewayModel = model || "google/gemini-3-flash-preview";
    return await handleLovableStream(messages, systemPrompt, gatewayModel);
  } catch (e) {
    console.error("patient-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
