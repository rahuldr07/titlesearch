import { cx } from "../../components/ui";

/**
 * A clerk's stamp, drawn in CSS — a rotated double-ruled box in the stamp
 * brown, not an image. −3.5° is ten times the sheet's own tilt on purpose:
 * matching the two angles would read as a print artefact rather than an act.
 * All-caps is legal here — a recorder's stamp is the serif certificate
 * register.
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
         * No opacity: the stamp ink clears 4.76:1 on paper, and opacity-80
         * composites it below AA — a failure no token audit finds, because
         * the token is fine. The aged look comes from the double rule and
         * the rotation.
         */
        "border-paper-stamp text-paper-stamp",
        className,
      )}
    >
      <span className="font-serif text-label leading-flat tracking-caps uppercase">
        {caption}
      </span>
      {/* A book/page or instrument number is data, so it is mono. */}
      <span className="font-mono text-label leading-flat">{detail}</span>
    </span>
  );
}
