/**
 * THE PERSON'S MARK — initials, derived once.
 *
 * Its own module because TWO places draw it now: the header chip and the
 * profile card's own header. Two copies of this derivation is two chances to
 * render a different person's mark in the same click, which is a small bug with
 * an outsized reading — the avatar is the only thing on screen that says whose
 * session this is.
 *
 * `A NAME IS NOT ALWAYS TWO WORDS`. "L. Vance" splits on both space and period,
 * so the abbreviated form gives LV rather than the L. that a naive
 * `split(" ")[0][0] + split(" ")[1][0]` would produce on the dotted initial.
 * Single-word names give one letter rather than crashing, and an empty name
 * gives an empty string rather than "undefined" — a person whose name the
 * session does not carry is a case the chrome must survive, not one it may
 * invent a mark for.
 *
 * JSX-free so it is testable in the node Vitest project with no DOM.
 */
export function initialsOf(actor: string): string {
  return actor
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
