import { NoValue } from "../../entities/field/NoValue";
import type { NoValueKind } from "../../entities/field/noValueStates";

/**
 * The no-value states, drawn together — the one cell in the gallery that is the
 * reference rather than an illustration of it.
 *
 * IT RENDERS THE REAL `NoValue`, not a restyled copy. A gallery that reimplements
 * what it documents can only ever prove that the gallery agrees with itself. The
 * point of seeing all six at once is to catch the failure CONTEXT §11 names —
 * that they "collapse into one grey dash" — and that failure is invisible unless
 * these are the same components the report renders.
 *
 * SIX, WHERE THE DESIGN DREW FOUR. The design predates the resolution recorded in
 * `noValueStates.ts`: four of these are statements about the DOCUMENT (n/a, not
 * found, silent, unreadable) and two are statements about the PIPELINE (not yet
 * extracted, readings disagree). The two were left undrawn, and `unsettled` was
 * then found on screen rather than by a test — which is precisely the argument
 * for the catalogue listing every render the UI can produce, not only the ones
 * that were sketched. A states gallery missing two states is the gap it exists
 * to close.
 *
 * THEY STACK, ONE PER ROW, EACH THE FULL WIDTH OF THE CELL — the design's own
 * arrangement, and it is load-bearing rather than tidy. Left as inline chips
 * they wrapped to their content, so the six ended up different widths on
 * different lines and the eye compared SHAPES. Every one the same rectangle
 * leaves border style, fill pattern and wording as the only things that differ,
 * which is the comparison the card exists to make. Nothing scrolls: a
 * horizontal scroller would hide half the set behind an interaction.
 */
const EVERY_NO_VALUE: readonly NoValueKind[] = [
  { kind: "not_present" },
  { kind: "not_found" },
  { kind: "silent" },
  { kind: "unreadable", page: 41 },
  { kind: "pending" },
  { kind: "unsettled" },
];

export function NoValueSample() {
  return (
    <div data-testid="no-value-gallery" className="flex w-full flex-col gap-3">
      {EVERY_NO_VALUE.map((value) => (
        <NoValue key={value.kind} value={value} />
      ))}
    </div>
  );
}
