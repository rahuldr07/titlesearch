/**
 * Relative luminance of a COMPUTED colour string, straight from the sRGB
 * formula.
 *
 * It lives beside the document entity rather than in a test file because the
 * assertion it serves is about the rendered page, and a story that measures the
 * thing it renders is the only place a "the document does not invert" claim can
 * actually be checked — `getComputedStyle` returns `rgb(…)`, so a token's value
 * is not knowable without parsing it back.
 *
 * DEFENSIVE ON PURPOSE. A missing channel reads as 0 rather than `NaN`: a
 * luminance of `NaN` makes every comparison false, so a story asserting "these
 * two are equal" would fail with a number nobody can interpret instead of the
 * colour mismatch it is really reporting.
 */
export function luminance(value: string): number {
  const parts = (value.match(/[\d.]+/g) ?? [])
    .slice(0, 3)
    .map((n) => Number(n) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (parts[0] ?? 0) + 0.7152 * (parts[1] ?? 0) + 0.0722 * (parts[2] ?? 0);
}
