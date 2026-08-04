import type { ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";

/**
 * The headline of a delivery sheet — the receipt's one typographic moment.
 *
 * WHY IT IS NOT `ScreenHeading`: that component is a MASTHEAD. It carries the
 * eyebrow that is the link home, a left-aligned two-column heading row and an
 * actions slot, none of which a centred receipt has or wants. What this screen
 * needs from it is only the type — and taking the whole masthead to get the
 * face would put a kicker and a back-link on a document.
 *
 * RULE: EVERY h1 IN THIS APP IS THE DISPLAY FACE. The reskin moved the display
 * face onto `ScreenHeading` and every masthead came with it; the three h1s that
 * are hand-rolled — this one, the amended sheet's, and the expired session's —
 * did not, because nothing connects them to it. FAILURE PREVENTED: the two
 * quietest screens in the product ended up the only two whose headline is set
 * in the body face, which does not read as restraint. It reads as a screen
 * somebody stopped working on.
 *
 * RULE: THE CLOSING PHRASE TAKES THE FRAUNCES ITALIC AT THE ACCENT'S DEEP INK,
 * and it is spelled as a descendant `<em>` for the same reason `ScreenHeading`
 * spells it that way: the call site writes the SEMANTIC element and one place
 * owns the four values. FAILURE PREVENTED: `font-display italic text-action-ink`
 * typed out at each call site is four tokens each of them can get wrong, and the
 * two sheets below would be the first pair to disagree.
 *
 * ONE COMPONENT FOR BOTH SHEETS, in this feature and not in `shared/ui`. The
 * finalized notice and the amended sheet are two states of one document, so the
 * definition is shared exactly as far as the document goes. Promoting it to the
 * kit would offer a second masthead to fifteen screens that already have one.
 */
export function SheetHeading({
  children,
  size = "lg",
}: {
  /** Wrap the closing phrase in `<em>`; this component paints it. */
  children: ReactNode;
  /**
   * `lg` — 30px, the finalized notice: a delivered order is the terminal state
   * and the sheet is the whole screen. NOT the 38px masthead step, which wraps
   * "Order 4176034-1 delivered" onto two lines inside this screen's 460px
   * measure and would make the receipt's one headline its ragged edge.
   * `md` — 26px, the amended sheet, a heading over a diff table rather than the
   * page's only object.
   *
   * Each is ONE STEP UP from what the hand-rolled h1s were set at (26 and 21),
   * and the step is deliberate: at the old sizes these read as card titles, and
   * a card title is what a receipt headline must not be mistaken for on a screen
   * whose only other object is a file row.
   */
  size?: "lg" | "md";
}) {
  return (
    <h1
      className={cn(
        "mb-3 font-display font-title leading-flat text-ink-primary",
        "[&_em]:font-normal [&_em]:italic [&_em]:text-action-ink",
        size === "lg" ? "text-5xl opsz-120" : "text-4xl opsz-90",
      )}
    >
      {children}
    </h1>
  );
}
