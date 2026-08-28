/**
 * A TOKEN'S VALUE, as the browser reports a COMPUTED colour.
 *
 * For assertions. `check-rules.mjs` bans hex in `src/`, INCLUDING in tests, and
 * that ban is right rather than merely inconvenient: a test spelling
 * `rgb(91, 75, 138)` is a SECOND copy of `--color-action`. It passes when the
 * component is wrong in the same way the test is, and it fails when the palette
 * is legitimately revalued — and five registers are already in this repo's
 * record, so that is a scheduled event, not a hypothetical.
 *
 * Resolving both sides of an assertion through the same custom property checks
 * the RELATIONSHIP ("this door wears the action colour") instead of the value,
 * which is what a design-token system is for.
 *
 * PAINTING IT ONTO A THROWAWAY ELEMENT is what normalises the spelling.
 * `getPropertyValue("--color-action")` returns the HEX the token file wrote,
 * while `getComputedStyle(el).backgroundColor` always returns `rgb(...)`; the
 * two never compare equal as strings. Passing the value through `color` on a
 * real element makes the browser do the conversion, so both sides arrive in the
 * same form.
 */
export function tokenColour(name: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}
