import { Narrative } from '../../types/pcr';

/*
  Defensive parsing of the pcr-narrative Edge Function response. The model is
  instructed to return strict JSON, but we never trust that: strip accidental
  code fences, tolerate leading/trailing prose, validate the shape, and fall
  back to empty copy so the UI degrades to manual writing rather than breaking.
  Pure and unit-tested; the Edge Function inlines the same logic server-side.
*/

function normalise(obj: unknown): Narrative {
  if (!obj || typeof obj !== 'object') return { overview: '', sections: {} };
  const record = obj as Record<string, unknown>;
  const overview = typeof record.overview === 'string' ? record.overview : '';
  const sections: Record<string, string> = {};
  if (record.sections && typeof record.sections === 'object') {
    for (const [k, v] of Object.entries(record.sections as Record<string, unknown>)) {
      if (typeof v === 'string') sections[k] = v;
    }
  }
  return { overview, sections };
}

/**
 * Coerce whatever the Edge Function returned (an already-parsed object from
 * supabase.functions.invoke, or a raw string) into a valid Narrative.
 */
export function coerceNarrative(data: unknown): Narrative {
  if (typeof data === 'string') return parseNarrativeResponse(data);
  return normalise(data);
}

export function parseNarrativeResponse(text: string): Narrative {
  const fallback: Narrative = { overview: '', sections: {} };
  if (typeof text !== 'string' || text.trim() === '') return fallback;

  // Strip a ```json ... ``` or ``` ... ``` wrapper if present.
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return normalise(JSON.parse(cleaned));
  } catch {
    /* fall through to brace extraction */
  }

  // Last resort: extract the first {...} block from surrounding prose.
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return normalise(JSON.parse(match[0]));
    } catch {
      /* fall through */
    }
  }
  return fallback;
}
