import type { BenchResultsResponse } from "@titlepipe/contract";
import { BenchSectionCard } from "./BenchSectionCard";

/**
 * THE RUN TOLD AS RECORDS — the same fields the matrix counts, with the reason
 * each one missed attached.
 *
 * ══ WHY THIS PANE IS NOT THE VIRTUALIZED `Table` ═══════════════════════════
 *
 * The kit's `Table` is the right answer for a long list of short cells and is
 * used for the matrix beside this. It is the WRONG answer here, and the reason
 * is one line of `tableRow.tsx`: every cell is `truncate` inside a 44px row.
 *
 * A `BenchFailRow` carries `source_note`, and in this run one of them reads
 * "Security deed, degraded 1987 fax p 3 — artefact over the amount; words line
 * legible. §5: words prevail." That sentence IS the finding — it is the
 * citation that says whether the model or the seed is wrong — and a row that
 * clips it after forty characters has rendered a failure with its evidence
 * removed. AGENTS.md: "never emit a value you can't cite." A citation the
 * reader cannot finish reading is not a citation.
 *
 * So the failures render as records with room for their prose, in the
 * card-with-hairline-rows shape RECIPES §Card specifies, and the pane scrolls.
 * The run holds single-digit failures per section by design — if a section ever
 * failed at a scale where virtualization mattered, the finding would be the
 * scale, not the rows.
 *
 * ══ THE SERVER'S ORDER, AND EVERY SECTION ══════════════════════════════════
 *
 * Sections that failed nothing are still drawn. A list filtered down to
 * failures reads as the whole run, and a reader cannot tell a section that
 * passed from a section that was never seeded — which is exactly the
 * distinction `location`'s note is about ("4 of 5 seeded — location.zip is
 * ORDER_SUPPLIED, absent from every denominator").
 */
export function BenchSectionList({
  sections,
}: {
  readonly sections: BenchResultsResponse["sections"];
}) {
  return (
    <section aria-labelledby="bench-sections-heading" className="flex min-h-0 flex-col gap-6">
      <h2
        id="bench-sections-heading"
        className="text-label font-bold leading-flat text-ink-muted"
      >
        Each section, and every field it missed
      </h2>
      {/*
       * `tabIndex` + a name: a region that scrolls must be reachable by
       * keyboard (WCAG 2.1.1, axe's `scrollable-region-focusable`), and a bare
       * tab stop that announces nothing is its own defect.
       */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Bench failures by section"
        className="tp-state flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto pr-4"
      >
        {sections.map((section) => (
          <BenchSectionCard key={section.section} section={section} />
        ))}
      </div>
    </section>
  );
}
