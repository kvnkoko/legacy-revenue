/**
 * Plain-language number helpers.
 *
 * Deliberately NOT in a 'use client' file. These are called during server
 * rendering (the Overview page is a Server Component). When they lived beside
 * the Explain component in a 'use client' module, importing them from the
 * server gave back a client *reference* rather than the function, and calling
 * one crashed the page with "TypeError: M is not a function".
 *
 * Rule of thumb: pure helpers live here; anything that renders lives in
 * components/charts/plain-language.tsx.
 */

/** Money as words: 482,238,452 → "482.2 million". Clearer than "482.2M". */
export function plainMoney(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)} billion`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} million`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)} thousand`;
  return `${sign}${Math.round(abs)}`;
}

/** "grew by 12%" / "fell by 8%" / "stayed about the same" — no jargon. */
export function plainChange(pct: number): string {
  const rounded = Math.round(Math.abs(pct));
  if (rounded < 2) return 'stayed about the same';
  return `${pct > 0 ? 'grew' : 'fell'} by ${rounded}%`;
}

/** Sentence case: only the first letter is capitalised ("Fell by 62%"). */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
