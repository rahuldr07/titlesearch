/**
 * A token's value, as the browser reports a computed colour — for
 * assertions, so both sides resolve through the same custom property and the
 * test checks the relationship rather than a second copy of the value.
 * Painting onto a throwaway element normalises the spelling:
 * getPropertyValue returns the hex the token file wrote, while
 * getComputedStyle always returns rgb(...), and the two never compare equal
 * as strings.
 */
export function tokenColour(name: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}
