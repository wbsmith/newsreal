/**
 * Coerce model-output values into a string for safe React rendering.
 *
 * Smaller local LLMs sometimes over-structure their JSON — they'll emit a
 * nested object where the prompt asked for a single string. Rendering that
 * object as a React child throws "Objects are not valid as a React child"
 * (React error #31).
 *
 * This is the UI-side defense; the pipeline now coerces too, but cached
 * data written before that fix still contains objects.
 */
export function safeText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(safeText).filter(Boolean).join(' ');
  if (typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).map(safeText).filter(Boolean).join(' ');
  }
  return String(v);
}
