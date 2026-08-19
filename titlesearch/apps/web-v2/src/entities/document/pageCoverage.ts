import { cva } from "class-variance-authority";
import type { SourcePage } from "@titlepipe/contract";

/**
 * The four things that can be true of a package page, and how each one is drawn.
 *
 * RULE: coverage is stated for every page in the package, never only for the
 * pages a reader typed. FAILURE PREVENTED: a strip of seven chips out of a
 * 64-page package has NO representation at all for the other fifty-seven — they
 * are not shown as skipped, they are simply absent, which reads as "the package
 * has seven pages" to anyone who has not memorised the denominator elsewhere on
 * the same pane.
 *
 * ALL FOUR TIERS ARE THE SERVER'S, NEVER INFERRED. `degraded` is consulted only
 * once a page is confirmed read in full, mirroring `PageFacsimile`'s own
 * precedence, so nothing here invents a fifth combination the server did not
 * send.
 *
 * CONTRACT GAP: the 2026-07-28 export draws SIX tiers — it adds "an open
 * decision cites it" and "a report value cites it" (`TitlePipe.dc.html:3047`).
 * Both are a browser-side join over `Field.source_page` and `Field.state`, which
 * is a coverage verdict computed from field state by the client, and coverage
 * tiers are the server's. They are refused here rather than approximated: if
 * they are wanted, `OrderPagesResponse` gains them and the server supplies them.
 *
 * `partial` and `unseen` must stay as distinct as the field-level NA states do.
 * Collapsing "present but not read in full" into "never served" would hide that
 * the classifier looked at the page and chose not to read it, which is a
 * different fact from the page not appearing in the served text at all.
 */
export type PageSpineTier = "read" | "degraded" | "partial" | "unseen";

export interface PageSpineCell {
  n: number;
  tier: PageSpineTier;
}

/**
 * Colour is secondary — same rule as the no-value renders: `unseen` takes a
 * DASHED border, the "quiet, correct, not a gap" treatment, so the majority
 * state still reads as normal in greyscale rather than as a pale version of a
 * page that was read.
 */
export const cellClasses = cva("rounded-2 border", {
  variants: {
    tier: {
      read: "border-state-settled bg-state-settled-surface",
      degraded: "border-state-attend bg-state-attend-surface",
      partial: "border-state-idle-border bg-state-idle-surface",
      unseen: "border-dashed border-line-strong bg-surface-app",
    },
  },
  defaultVariants: { tier: "unseen" },
});

export const CELL_LABEL: Record<PageSpineTier, string> = {
  read: "read in full",
  degraded: "read in full — degraded scan",
  partial: "present, not read in full",
  unseen: "not served — no reader typed this page",
};

export function classifyPage(page: SourcePage | undefined): PageSpineTier {
  if (page === undefined) return "unseen";
  if (!page.read_in_full) return "partial";
  if (page.degraded) return "degraded";
  return "read";
}

/**
 * One cell per package page, in order. The client does not count pages — the
 * total is `OrderPagesResponse.total_pages` and this only walks it.
 */
export function coverageCells(
  totalPages: number,
  pages: readonly SourcePage[],
): readonly PageSpineCell[] {
  const byPage = new Map(pages.map((page) => [page.n, page]));
  return Array.from({ length: totalPages }, (_, i) => ({
    n: i + 1,
    tier: classifyPage(byPage.get(i + 1)),
  }));
}

/**
 * A tally of the squares the legend sits under — a description of the picture,
 * not a second opinion about the order. The buckets are the same ones that
 * colour the cells, so the legend can never disagree with the map, and the four
 * figures sum to the package.
 */
export function coverageCounts(
  cells: readonly PageSpineCell[],
): Record<PageSpineTier, number> {
  const counts: Record<PageSpineTier, number> = {
    read: 0,
    degraded: 0,
    partial: 0,
    unseen: 0,
  };
  for (const cell of cells) counts[cell.tier] += 1;
  return counts;
}
