import type { ReactNode } from "react";
import { cx } from "../../components/ui";

/**
 * Evidence renders as paper: serif, warm stock, clerk stamps, justified
 * text — never grey placeholder bars, because a reviewer who has learned to
 * read grey bars as "not here yet" will read a rendered page that way too.
 * Warm stock is reserved for exactly this; a panel that borrows it is
 * claiming to be evidence. The tilt and grain are CSS art — no assets.
 */
export type PaperSheetProps = {
  /** The page's own body. Serif and justified; the caller supplies the words. */
  readonly children: ReactNode;
  /** The clerk stamp, if this page carries one. */
  readonly stamp?: ReactNode | undefined;
  /**
   * A degraded scan — microfilm density loss, a bad fax. A server-reported
   * property of the page, never inferred from how extraction went.
   */
  readonly degraded?: boolean | undefined;
  /**
   * Which stock. `scan` is the warm, tilted, grained county exhibit —
   * something photographed. `page` is the clean flat stock a deliverable is
   * PRINTED on: `--color-page`, no tilt, no grain. RECIPES lists them as two
   * rows and the composer was drawing its certificate on the scan stock, so
   * the document being typed looked like a document being photographed.
   */
  readonly stock?: "scan" | "page" | undefined;
  readonly className?: string | undefined;
};

export function PaperSheet({
  children,
  stamp,
  degraded,
  stock = "scan",
  className,
}: PaperSheetProps) {
  const printed = stock === "page";
  return (
    <div
      data-paper-sheet
      data-stock={stock}
      data-degraded={degraded === true}
      className={cx(
        "relative border shadow-page border-page-line px-14 py-15",
        printed ? "rounded-none bg-page" : "tp-paper-tilt tp-paper-grain rounded-paper",
        // The two stocks. Degraded is a warm step below the clean scan.
        !printed && (degraded === true ? "tp-scan-filter bg-scan" : "bg-surface-paper"),
        className,
      )}
    >
      {stamp !== undefined && (
        <div className="mb-8 flex justify-end">{stamp}</div>
      )}
      {/* Justified, serif, on the scan leading (2.1) — typed instruments are
          set loose, and a tight leading makes a scan read as a web page. */}
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
 * The cited line on the page. 1.5px rather than 1 or 2: visibly heavier than
 * the page's own rules without becoming UI chrome sitting on top of a
 * document — a mark made on the paper, in the evidence vocabulary.
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
