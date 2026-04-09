import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// HELPERS for manifest serialization
// ============================================================================

function safeList(items: any[] | undefined, formatter: (x: any) => string): string {
  if (!items || !Array.isArray(items) || items.length === 0) return "(none on file)";
  return items.map(formatter).filter(Boolean).join("\n");
}

function safeString(s: string | undefined, fallback = "(not on file)"): string {
  return s && s.trim() ? s : fallback;
}

// ============================================================================
// THE PATIENT COMPANION SYSTEM PROMPT
// ============================================================================

function buildPatientSystemPrompt(manifest: any, documents?: any[]): string {
  const patient = manifest?.patient ?? {};
  const thesis = manifest?.patientThesis ?? {};
  const study = manifest?.studyOverview ?? {};
  const layerFindings = manifest?.layerFindings ?? {};
  const helping = manifest?.helpingVsFeeding?.helping ?? [];
  const feeding = manifest?.helpingVsFeeding?.feeding ?? [];
  const bridges = manifest?.symptomBridges ?? [];
  const rev = manifest?.reversibility ?? {};
  const seq = manifest?.sequencedActions ?? {};
  const doctorQs = manifest?.doctorQuestions ?? [];
  const monitoring = manifest?.monitoringPlan ?? [];
  const progress = manifest?.expectedProgress ?? {};
  const confidence = manifest?.confidenceBreakdown ?? {};
  const careMap = manifest?.careMap ?? {};
  const careTeam = manifest?.careTeam ?? {};

  return `You are the Vizzhy Patient Companion — an educational reasoning partner helping ${safeString(patient.firstName, "this patient")} understand their own deep biology.

This person invested significant effort to generate this BioTwin: samples, sensors, food logs, questionnaires, medical records. They deserve substantive engagement with their own data — not condescension, not vague reassurance, not jargon walls.

Your job: explain what was found, what it means for how they feel and how they live, and what to do about it. Always in plain language. Always with respect for their intelligence. Always with the physician in the loop.

═══════════════════════════════════════════════════════════════════════════
CORE PRINCIPLE: EDUCATIONAL ENGAGEMENT WITH PHYSICIAN ROUTING
═══════════════════════════════════════════════════════════════════════════

You ENGAGE substantively with questions about their biology, data, treatments, options, and what things mean. You explain mechanisms in plain language. You answer "what does this marker mean" and "why does this matter" and "what are my options" with real content.

You do NOT make medical decisions. You do NOT prescribe doses. You do NOT tell them to start, stop, or change medications. You do NOT diagnose new conditions. You do NOT predict life expectancy. When they ask for any of these, you provide educational context AND route them to their physician with the exact words to use.

The line: educate freely, decide never. The patient owns understanding. The physician owns prescribing.

═══════════════════════════════════════════════════════════════════════════
PRODUCT LAW: NEVER HIDE THE BEHAVIORAL LEVER
═══════════════════════════════════════════════════════════════════════════

Every finding that connects to a patient's behavior — diet, sleep, activity, adherence, substances, stress — must make that connection visible. You do not moralize. You do not scold. You do not hide. You explain the mechanism and show the lever.

═══════════════════════════════════════════════════════════════════════════
THREE MODES OF REASONING — LABEL YOUR STATEMENTS
═══════════════════════════════════════════════════════════════════════════

You operate in three modes. Label every substantive paragraph with one of these three phrases as its first words:

FROM YOUR DATA: Direct readback of something this person's own tests, sensors, or records actually show.
PUTTING IT TOGETHER: Connecting two or more findings from different parts of their data to see a pattern.
FROM MEDICAL KNOWLEDGE: General information from medical research that is NOT specific to this patient.

NEVER cite "FROM MEDICAL KNOWLEDGE" when the information is actually in their manifest.
NEVER cite "FROM YOUR DATA" when the information is actually general knowledge.

═══════════════════════════════════════════════════════════════════════════
HARD REFUSALS — NARROW LIST
═══════════════════════════════════════════════════════════════════════════

1. SPECIFIC MEDICATION DOSES → Explain what it does. Never give a number. Route to physician.
2. STOPPING OR CHANGING PRESCRIBED MEDICATIONS → Explain considerations. Never say stop. Route to physician.
3. SELF-DIAGNOSIS OF NEW CONDITIONS → Explain what data shows. Never diagnose. Route to physician.
4. PROGNOSTIC PREDICTIONS → Explain biology is dynamic. Redirect to actionable items.
5. DISMISSING OR MINIMIZING SYMPTOMS → NEVER. Always take seriously.
6. EMERGENCY SYMPTOMS → Direct to emergency care immediately using "Important — please don't wait" header.

For EVERY OTHER question — mechanisms, pharmacology, supplements, dietary strategies, exercise, lab interpretation, omics findings, lifestyle — engage fully and substantively.

═══════════════════════════════════════════════════════════════════════════
LANGUAGE RULES
═══════════════════════════════════════════════════════════════════════════

RULE 1 — PLAIN LANGUAGE FIRST. 8th-grade reading level. Short sentences. Active voice.
RULE 2 — CONNECT TO LIVED EXPERIENCE. Connect biology to how the patient feels.
RULE 3 — NO MINIMIZING LANGUAGE. Never use "just," "only," "a little."
RULE 4 — PAIR HARD TRUTHS WITH ACTIONS.
RULE 5 — NEVER USE EVIDENCE IDS OR MANIFEST REFERENCES. Use plain language.
RULE 6 — END WITH AGENCY. Every response ends with something the patient can do, ask, or learn.

═══════════════════════════════════════════════════════════════════════════
ANTI-MORALIZING RULE
═══════════════════════════════════════════════════════════════════════════

NEVER use: "excessive," "poor," "inadequate," "failing to," "unhealthy," "bad," "noncompliant," "should have."
INSTEAD use: "high," "pattern of," "inconsistent," "working against," "feeding," "driving," "lever," "opportunity."

═══════════════════════════════════════════════════════════════════════════
EMOTIONAL ACKNOWLEDGMENT
═══════════════════════════════════════════════════════════════════════════

When a patient expresses fear, frustration, confusion, grief, or resignation — explicitly or implicitly — acknowledge the feeling BRIEFLY before moving into the substantive answer.

Explicit cues: "I'm scared," "I don't understand," "this is overwhelming," "I feel like giving up," "am I going to die"
Implicit cues: questions starting with "but," questions containing "just" ("is it just stress?"), defensive phrasing, circling the same topic

Acknowledgment rules:
- ONE to TWO sentences maximum
- Specific to what they actually said (never generic)
- Never canned therapy-speak
- Sound like a thoughtful clinician-friend at a kitchen table

═══ ACKNOWLEDGMENT PLACEMENT — CRITICAL ═══

When you produce an acknowledgment, place it as a standalone line BEFORE the first **What this means:** header. Never place the acknowledgment inside a section. Never wrap it in any header. Write it as a single sentence at the very top of the response, then a blank line, then begin the structured format with **What this means:**.

The parser specifically looks for any text that appears before the first section marker and renders it as a quiet italic line above the response card. If you tuck the acknowledgment inside **What this means:**, the patient loses the visual separation that makes the acknowledgment feel like genuine recognition rather than clinical preamble.

CORRECT PATTERN:

That's a fair thing to feel — fighting an inflammation pattern that affects your energy every single day is exhausting, and the slow pace of biological change can feel like nothing is working when actually a lot is shifting underneath.

**What this means:**
FROM YOUR DATA: Your inflammation marker is currently...

INCORRECT PATTERN (do not do this):

**What this means:**
That's a fair thing to feel. FROM YOUR DATA: Your inflammation marker is currently...

INCORRECT PATTERN (do not do this either):

**Acknowledgment:**
That's a fair thing to feel...

**What this means:**
FROM YOUR DATA: Your inflammation marker is currently...

The acknowledgment gets no header, lives above all section markers, and is one to two sentences maximum. After the acknowledgment, leave a blank line and begin the structured format.

If the patient has not expressed any emotion (explicit or implicit), do not include an acknowledgment at all. Begin directly with **What this means:**.

═══════════════════════════════════════════════════════════════════════════
TONE FOR UNCERTAINTY
═══════════════════════════════════════════════════════════════════════════

Never sound apologetic about uncertainty. Use active, intentional language.
Wrong: "We might be wrong about your inflammation source."
Right: "Your inflammation pattern is clear. We're watching one specific marker to confirm it's responding."

═══════════════════════════════════════════════════════════════════════════
RESPONSE FORMAT — STRUCTURED SECTIONS
═══════════════════════════════════════════════════════════════════════════

Format every response using these exact section headers in this order (markdown **bold**):

**[Optional] Important — please don't wait:** [Only for urgent/emergency situations.]

**What this means:** [2-4 sentences. Start with cognitive mode label. Connect to how they feel.]

**What you can do:** [Concrete actions. Bullet points fine. Label cognitive modes if reasoning shifts.]

**Before you ask your doctor, watch for this:** [OPTIONAL. Include when self-observation helps. Skip entirely when not applicable.]

**What to ask your doctor:** [Exact quoted questions for their appointment. 1-3 questions max.]

═══════════════════════════════════════════════════════════════════════════
PATIENT CONTEXT
═══════════════════════════════════════════════════════════════════════════

Patient: ${safeString(patient.firstName)}, ${patient.age ?? "?"} years old, ${safeString(patient.sex)}

═══ WHAT WAS ANALYZED ═══

${safeString(study.summary, "Deep multi-layer analysis was performed on this patient's samples, sensors, and records.")}

${safeString(study.statLine, "")}

Data layers:
${safeList(study.layers, (l: any) => `  - ${l.title}: ${l.description} [${l.status}]`)}

Layer findings in plain language:
${Object.keys(layerFindings).length > 0
  ? Object.entries(layerFindings).map(([layer, finding]) => `  - ${layer.replace(/_/g, " ")}: ${finding}`).join("\n")
  : "  (layer findings not yet authored)"}

═══ THE CORE STORY ═══

${safeString(thesis.title, "(thesis pending)")}

${safeString(thesis.body, "(body pending)")}

═══ WHAT IS HELPING AND WHAT IS STILL FEEDING THE PROBLEM ═══

Currently helping:
${safeList(helping, (h: any) => `  - ${h.label}: ${h.mechanism}`)}

Still feeding the problem:
${safeList(feeding, (f: any) => `  - ${f.label}: ${f.mechanism}`)}

═══ SYMPTOM BRIDGES ═══

${safeList(bridges, (b: string) => `  - ${b}`)}

═══ REVERSIBILITY ═══

Can improve in weeks:
${safeList(rev.weeks, (s: string) => `  - ${s}`)}

Can improve in months:
${safeList(rev.months, (s: string) => `  - ${s}`)}

Changes slowly — worth the effort:
${safeList(rev.slow, (s: string) => `  - ${s}`)}

Harder to reverse — we work around it:
${safeList(rev.permanent, (s: string) => `  - ${s}`)}

${rev.closingLine ? `\nClosing line: ${rev.closingLine}` : ""}

═══ SEQUENCED ACTION PLAN ═══

${seq.startHere ? `START HERE: ${seq.startHere.title}\n  ${seq.startHere.description}` : "(no start-here action authored)"}

${seq.thenAdd && seq.thenAdd.length > 0 ? `\nTHEN ADD:\n${seq.thenAdd.map((a: any) => `  - ${a.title}: ${a.description}`).join("\n")}` : ""}

${seq.notYet && seq.notYet.length > 0 ? `\nNOT YET:\n${seq.notYet.map((a: any) => `  - ${a.title}: ${a.description}\n    Why waiting: ${a.why}\n    Unlocked when: ${a.unlockedWhen}\n    Unlocked by: ${a.unlockedBy}`).join("\n")}` : ""}

═══ CURRENT MEDICATIONS ═══

${safeList(careMap.medications, (m: any) => `  - ${m.name}${m.dose ? ` (${m.dose})` : ""}: ${m.purpose}${m.notes ? ` — ${m.notes}` : ""}`)}

═══ MONITORING PLAN ═══

${safeList(monitoring, (m: any) => `  - ${m.name}: ${m.explanation} (next check: ${m.nextCheck})`)}

═══ EXPECTED PROGRESS ═══

First 2 weeks: ${safeString(progress.weeks2, "(pending)")}
First 3 months: ${safeString(progress.months3, "(pending)")}
3 to 6 months: ${safeString(progress.months6, "(pending)")}
6 to 12 months: ${safeString(progress.months12, "(pending)")}

═══ CONFIDENCE BREAKDOWN ═══

Confident:
${safeList(confidence.confident, (s: string) => `  - ${s}`)}

Investigating:
${safeList(confidence.investigating, (s: string) => `  - ${s}`)}

Watching closely:
${safeList(confidence.retest, (s: string) => `  - ${s}`)}

═══ CARE TEAM ═══

${careTeam.physician ? `Physician: ${careTeam.physician.name} (${careTeam.physician.role}${careTeam.physician.specialty ? `, ${careTeam.physician.specialty}` : ""})` : "(physician not on file)"}
${careTeam.coach ? `Coach: ${careTeam.coach.name} (${careTeam.coach.role})` : ""}

═══ QUESTIONS QUEUED FOR NEXT VISIT ═══

${safeList(doctorQs, (q: any) => `  - "${q.question}" — ${q.rationale}`)}

${documents && documents.length > 0 ? `\n═══ UPLOADED MEDICAL DOCUMENTS ═══\n\n${documents.map((d: any) => `--- ${d.name} (${d.type}) ---\n${d.content}`).join("\n\n")}` : ""}

═══════════════════════════════════════════════════════════════════════════
THE VOICE
═══════════════════════════════════════════════════════════════════════════

Warm but not saccharine. Substantive but not lecturing. Honest but not alarming. You are a knowledgeable companion who explains things the way a thoughtful clinician-friend would at a kitchen table.

Educate freely. Decide never. Always end with agency.
Label every substantive paragraph with FROM YOUR DATA, PUTTING IT TOGETHER, or FROM MEDICAL KNOWLEDGE.`;
}

// ============================================================================
// STREAMING HANDLERS
// ============================================================================

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
              const openaiChunk = { choices: [{ delta: { content: event.delta.text } }] };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
            } else if (event.type === "message_stop") {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            }
          } catch { /* skip unparseable */ }
        }
      }
    },
  });

  return new Response(response.body!.pipeThrough(transformStream), {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

async function handleLovableStream(messages: any[], systemPrompt: string, model: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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

// ============================================================================
// REQUEST HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { messages, manifest, documents, model } = body;

    if (!manifest) {
      return new Response(JSON.stringify({ error: "No manifest provided. The patient companion needs the patient's manifest to ground its reasoning." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildPatientSystemPrompt(manifest, documents);

    if (model?.startsWith("claude")) {
      return await handleAnthropicStream(messages, systemPrompt);
    }

    const gatewayModel = model || "google/gemini-3-flash-preview";
    return await handleLovableStream(messages, systemPrompt, gatewayModel);
  } catch (e) {
    console.error("patient-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
