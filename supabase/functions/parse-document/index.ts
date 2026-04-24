// Using built-in Deno.serve (no remote std import) — std@0.168.0 was returning 500 from the bundler.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Extracts text from a PDF using Lovable AI's vision capabilities.
 * Receives a base64-encoded PDF, converts pages to images via pdf.js concepts,
 * and uses AI to extract structured text from the document.
 *
 * For simplicity and reliability, we use the AI gateway to read the PDF directly
 * since Gemini models support PDF input natively.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileBase64, fileName, mimeType } = await req.json();

    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "No file data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
    const mediaType = isPdf ? "application/pdf" : (mimeType || "application/octet-stream");

    // Use Gemini's native document understanding to extract text
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a medical document text extractor. Extract ALL text content from the uploaded document preserving structure. For lab results, extract:
- Patient name, date of birth, date of collection
- Each test name, result value, units, reference range, and flag (H/L/normal)
- Any notes or comments from the ordering physician

Format the output as clean, structured plain text. Use consistent formatting:
PATIENT: [name]
DOB: [date]
COLLECTION DATE: [date]
ORDERING PHYSICIAN: [name]

TEST RESULTS:
[Test Name] | [Value] [Units] | Reference: [range] | [Flag if abnormal]

NOTES:
[any notes]

If the document is not a lab result, extract all text preserving headers, sections, and structure. Never summarize or omit content — extract everything verbatim.`,
          },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: fileName || "document.pdf",
                  file_data: `data:${mediaType};base64,${fileBase64}`,
                },
              },
              {
                type: "text",
                text: "Extract all text content from this medical document. Preserve all values, dates, and structure exactly as shown.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI parse error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Failed to parse document" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      text: extractedText,
      fileName,
      pageCount: null, // Could be enhanced later
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
