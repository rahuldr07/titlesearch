import { cx } from "../../components/ui/cx";

/**
 * A CLERK'S STAMP, DRAWN IN CSS.
 *
 * Design README §Assets: "No binary assets … All paper/scan artwork is CSS."
 * So the stamp is a rotated double-ruled box in the stamp brown, not an image
 * and not an icon.
 *
 * −3.5° per design §Screens 7, and it is ten times the sheet's own −.35° on
 * purpose: a page is laid down slightly crooked, a stamp is pressed by a hand.
 * Matching the two angles would read as a print artefact rather than as an act.
 *
 * ALL-CAPS is legal here. Rule 4 allows it in exactly two places, one of which
 * is "serif certificate headings" — a recorder's stamp is that register.
 */
export type ClerkStampProps = {
  /** The stamp's own words, e.g. "Recorded". Never composed from state. */
  readonly caption: string;
  /** The line under it: book/page, instrument number, recording timestamp. */
  readonly detail: string;
  readonly className?: string | undefined;
};

export function ClerkStamp({ caption, detail, className }: ClerkStampProps) {
  return (
    <span
      data-clerk-stamp
      className={cx(
        "tp-clerk-stamp inline-flex flex-col items-center gap-1",
        "rounded-paper border-2 border-double px-6 py-3",
        /*
         * NO OPACITY. A stamp fading into the stock is the obvious way to draw
         * one, and it is how this failed: `--color-paper-stamp` clears 4.76:1
         * on paper, and `opacity-80` composited it down to 3.13:1 — a real AA
         * failure that no token audit would ever find, because the token is
         * fine. The aged look comes from the double rule and the rotation.
         */
        "border-paper-stamp text-paper-stamp",
        className,
      )}
    >
      <span className="font-serif text-label leading-flat tracking-caps uppercase">
        {caption}
      </span>
      {/* Rule 3: a book/page or instrument number is data, so it is mono. */}
      <span className="font-mono text-label leading-flat">{detail}</span>
    </span>
  );
}
