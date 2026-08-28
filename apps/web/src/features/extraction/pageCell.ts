import type { SourcePage } from "@titlepipe/contract";

/**
 * THE FOUR PAINTS A MATRIX CELL CAN TAKE, and the sentence each one means.
 *
 * Split out of `PageMatrix.tsx` so the vocabulary and the legend that explains
 * it are one table rather than two lists that can drift — the legend below is
 * generated from the same array the cells are painted from.
 *
 * Every one of these is the SERVER'S word. `degraded` in particular is "never
 * inferred client-side" (endpoints.ts:678), so no cell reads an empty
 * `lines[]` or a false `read_in_full` and concludes the scan was bad — that
 * conflation is the same one `NOT_PRESENT` / `PRESENT_UNREADABLE` exists to
 * prevent (INVARIANT 7).
 *
 * A page with NO ENTRY in `pages[]` is the fourth member and the reason
 * INVARIANT 34 exists: `OrderPagesResponse.pages` is a SAMPLE of the package
 * (packages/mocks data.ts:61-64), so a page absent from the array is a page
 * nobody read — not a page that does not exist.
 */
export type CellState = "read" | "partial" | "degraded" | "unread";

export function stateOf(page: SourcePage | undefined): CellState {
  if (page === undefined) return "unread";
  if (page.degraded) return "degraded";
  if (!page.read_in_full) return "partial";
  return "read";
}

/**
 * The design draws the matrix as flat 12x18 blocks with no text — at that size
 * a cell could not carry any — so the whole sentence lives in `title` and in
 * the accessible name, which is also how the reference app does it.
 */
export function describe(n: number, page: SourcePage | undefined): string {
  if (page === undefined) return `Page ${n} — no reader read this page`;
  if (page.degraded) return `Page ${n} — ${page.kind} · the server marked this scan degraded`;
  if (!page.read_in_full) return `Page ${n} — ${page.kind} · not read in full`;
  return `Page ${n} — ${page.kind} · read`;
}

/*
 * THE FILLS ARE THE TINTS, NOT THE SURFACES, and that is a correction the
 * rendered screen forced. The first pass painted these with the same tokens
 * `CoverageSpine` uses — `bg-surface-sunken` for unread, `bg-state-halt-surface`
 * for degraded. Those read fine as a 30px-tall spine under a page, and at 12x18
 * on a white card they are invisible: measured, the whole matrix rendered as a
 * blank row of hairlines. A coverage map nobody can see is worse than none.
 *
 * So each state takes the strongest member of its own family that is still a
 * tint. `--color-state-halt-muted` is `#e4b0aa`, which is the exact value the
 * reference app fills its degraded blocks with, and `--color-surface-app` is
 * the canvas grey the reference uses for a page it has not reached.
 */
export const PAINT: Readonly<Record<CellState, string>> = {
  read: "border-scan-line bg-scan",
  partial: "border-dashed border-scan-line bg-surface-paper",
  degraded: "border-state-halt-border bg-state-halt-muted",
  unread: "border-line-strong bg-surface-app",
};

/** The design's legend row, in the order a reader meets the states. */
export const LEGEND: readonly { readonly state: CellState; readonly label: string }[] = [
  { state: "read", label: "Read" },
  { state: "partial", label: "Not read in full" },
  { state: "degraded", label: "Degraded scan" },
  { state: "unread", label: "Nobody read it" },
];
