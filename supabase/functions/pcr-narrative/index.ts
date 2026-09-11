/*
  MOTIX PCR Narrative Edge Function

  Drafts a Post-Campaign Report narrative from a fully-computed PcrReportModel.
  Structure, CORS handling and auth mirror the `chat` function. Reuses the
  existing Vault ANTHROPIC_API_KEY (no new secret). verify_jwt = true.

  Contract:
    Input:  { model: PcrReportModel, tone_description?: string, tone_reference?: string }
    Output: STRICT JSON { overview: string, sections: { [key]: string } }

  Safety: the model writes using ONLY figures present in `model`; never states
  or implies sales, brand lift, recall or any outcome not in the data; never
  invents numbers, dollar values or placements; British English; matches the
  supplied tone if given, else neutral and factual. tone_reference guides voice
  only and is never echoed verbatim. On any failure the function returns the
  empty fallback { overview: "", sections: {} } so the frontend falls back to
  manual copy rather than breaking.

  Deploy: supabase functions deploy pcr-narrative
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://your-production-domain.netlify.app", // Replace with actual production domain
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
};

interface NarrativeResult {
  overview: string;
  sections: Record<string, string>;
}

const EMPTY: NarrativeResult = { overview: "", sections: {} };

/** Defensive parse: strip code fences, tolerate prose, validate shape. */
function parseNarrative(text: string): NarrativeResult {
  if (typeof text !== "string" || text.trim() === "") return EMPTY;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const normalise = (obj: unknown): NarrativeResult => {
    if (!obj || typeof obj !== "object") return EMPTY;
    const rec = obj as Record<string, unknown>;
    const overview = typeof rec.overview === "string" ? rec.overview : "";
    const sections: Record<string, string> = {};
    if (rec.sections && typeof rec.sections === "object") {
      for (const [k, v] of Object.entries(rec.sections as Record<string, unknown>)) {
        if (typeof v === "string") sections[k] = v;
      }
    }
    return { overview, sections };
  };
  try {
    return normalise(JSON.parse(cleaned));
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return normalise(JSON.parse(m[0]));
      } catch {
        return EMPTY;
      }
    }
    return EMPTY;
  }
}

/** List section keys that actually have data, so the model only summarises those. */
function populatedSections(model: Record<string, unknown>): string[] {
  const keys: string[] = [];
  const broadcast = model.broadcast as Record<string, unknown> | undefined;
  if (broadcast && (broadcast.hasObserved || broadcast.hasAired || broadcast.hasBooked)) keys.push("broadcast");
  if (Array.isArray(model.reconciliation) && model.reconciliation.length > 0) keys.push("reconciliation");
  if (Array.isArray(model.mediaLines)) {
    for (const l of model.mediaLines as Array<Record<string, unknown>>) {
      if (typeof l.lineType === "string") keys.push(l.lineType);
    }
  }
  if (model.audience) keys.push("audience");
  return Array.from(new Set(keys));
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const ok = (body: NarrativeResult) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Auth: verify JWT with a user-scoped client (mirrors chat).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ALLOWED_EMAILS gate (mirrors chat).
    const allowedEmailsEnv = Deno.env.get("ALLOWED_EMAILS") ?? "";
    if (allowedEmailsEnv.trim() !== "") {
      const allowed = allowedEmailsEnv.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (!allowed.includes((user.email ?? "").toLowerCase())) {
        return new Response(JSON.stringify({ error: "Access not permitted" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => null);
    const model = body?.model;
    if (!model || typeof model !== "object") {
      return new Response(JSON.stringify({ error: "Invalid model" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const toneDescription = typeof body?.tone_description === "string" ? body.tone_description.slice(0, 2000) : "";
    const toneReference = typeof body?.tone_reference === "string" ? body.tone_reference.slice(0, 8000) : "";

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) return ok(EMPTY);

    const sectionKeys = populatedSections(model as Record<string, unknown>);
    // Cap the serialised model so a huge report cannot blow the token budget.
    const modelJson = JSON.stringify(model).slice(0, 60000);

    const system = [
      "You are a media analyst writing a factual Post-Campaign Report narrative for an Australian radio network.",
      "Write in British English.",
      "Use ONLY the figures present in the provided model JSON. Never invent numbers, dollar values, placements, station names or dates.",
      "Never state or imply sales, revenue, brand lift, recall, ROI, or any outcome that is not explicitly a figure in the model. Describe delivery only.",
      "Every figure already carries a source in the model (motix_observed, uploaded, manual); do not claim precision the data does not have.",
      toneDescription.trim() !== ""
        ? `Match this voice: ${toneDescription.trim()}. The reference copy that follows illustrates the voice ONLY — never copy its wording, figures or claims into your output.`
        : "Use a neutral, factual tone.",
      toneReference.trim() !== "" ? `Reference copy (voice guide only): """${toneReference.trim()}"""` : "",
      "Output STRICT JSON only. No preamble, no markdown, no code fences.",
      `Shape: {"overview": string, "sections": { key: string }}. The overview is 2-4 sentences summarising the campaign delivery. Provide one concise sentence per populated section, keyed exactly by these section keys: ${JSON.stringify(sectionKeys)}. Omit keys with no data.`,
    ]
      .filter((l) => l !== "")
      .join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: `Report model JSON:\n${modelJson}` }],
      }),
    });

    if (!response.ok) return ok(EMPTY);

    const data = await response.json();
    const text = Array.isArray(data?.content)
      ? data.content.map((c: { text?: string }) => c.text ?? "").join("")
      : "";
    return ok(parseNarrative(text));
  } catch {
    // Never break the client: fall back to empty so it uses manual copy.
    return ok(EMPTY);
  }
});
