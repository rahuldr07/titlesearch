import type { ReactNode } from "react";
import { cx } from "../../components/ui";

/**
 * RULE 8, AS A COMPONENT.
 *
 * "Evidence and deliverables render as paper (--paper-*): serif, warm stock,
 * clerk stamps, justified text. Never grey placeholder bars."
 *
 * The prohibition is the interesting half. A grey placeholder bar is what a
 * loading skeleton looks like, and a reviewer who has learned to read grey bars
 * as "not here yet" will read a rendered page as "not here yet" too. This
 * product's whole problem is that the page IS here and is hard to read
 * (CONTEXT §5 — median text-layer coverage well under 25%), so the page has to
 * look like a page even while it is degrading.
 *
 * Warm stock is the only warm family left in the register (`tokens.css`
 * §paper), and it is reserved for exactly this. A panel that borrows it is
 * claiming to be evidence.
 *
 * The −.35° tilt and the grain are CSS art — no assets, per design §Assets.
 */
export type PaperSheetProps = {
  /** The page's own body. Serif and justified; the caller supplies the words. */
  readonly children: ReactNode;
  /** The clerk stamp, if this page carries one. */
  readonly stamp?: ReactNode | undefined;
  /**
   * A degraded scan — microfilm density loss, a bad fax. The stock steps warm
   * and the ink weakens, per the `--color-scan-*` family. A SERVER-REPORTED
   * property of the page, never inferred from how extraction went.
   */
  readonly degraded?: boolean | undefined;
  readonly className?: string | undefined;
};

export function PaperSheet({ children, stamp, degraded, className }: PaperSheetProps) {
  return (
    <div
      data-paper-sheet
      data-degraded={degraded === true}
      className={cx(
        "tp-paper-tilt tp-paper-grain relative rounded-paper border shadow-page",
        "border-page-line px-14 py-15",
        // The two stocks. Degraded is a warm step below the clean scan.
        degraded === true ? "tp-scan-filter bg-scan" : "bg-surface-paper",
        className,
      )}
    >
      {stamp !== undefined && (
        <div className="mb-8 flex justify-end">{stamp}</div>
      )}
      {/*
        Justified, serif, and on the SCAN leading (2.1) rather than the app's —
        typed instruments are set loose and a tight leading makes a scan read as
        a web page. `--color-scan-ink-degraded` clears 4.55:1 under the filter.
      */}
      <div
        className={cx(
          "font-serif text-body leading-scan text-justify",
          degraded === true ? "text-scan-ink-degraded" : "text-page-ink",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * THE CITED LINE ON THE PAGE.
 *
 * Design §Screens 7: "citation box (1.5px accent + 13% fill)". 1.5px rather
 * than 1 or 2 because it must be visibly heavier than the page's own rules
 * without becoming a UI chrome border sitting on top of a document — this is a
 * mark made ON the paper, in the evidence vocabulary
 * (`--color-surface-evidence` / `--color-border-evidence`).
 */
export function CitationBox({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}) {
  return (
    <mark
      data-citation-box
      className={cx(
        "tp-citation-box rounded-paper bg-surface-evidence px-2 text-page-ink",
        className,
      )}
    >
      {children}
    </mark>
  );
}
