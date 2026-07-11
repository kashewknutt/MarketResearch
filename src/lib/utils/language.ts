import { franc } from "franc-min";

const DEVANAGARI_RE = /[ऀ-ॿ]/;

/**
 * Best-effort check: allows English and Hindi (Devanagari script) content
 * only. Devanagari is detected directly via unicode range rather than
 * trusting franc's specific language code, since franc's trigram model
 * frequently confuses closely related Devanagari languages (Hindi,
 * Bhojpuri, Marathi) on short text — any Devanagari text is close enough
 * to be relevant for a Hindi-speaking audience. For Latin-script text,
 * `und` (undetermined) is treated as allowed rather than rejected, since
 * short ad titles often don't give franc enough signal to be confident —
 * better to let an ambiguous case through than discard good content.
 */
export function isEnglishOrHindi(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (DEVANAGARI_RE.test(trimmed)) return true;
  const code = franc(trimmed, { minLength: 3 });
  return code === "eng" || code === "und";
}
