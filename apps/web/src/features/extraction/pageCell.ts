import type { SourcePage } from "@titlepipe/contract";

/**
 * THE FOUR PAINTS A MATRIX CELL CAN TAKE, and the sentence each one means.
 * The legend at the bottom is generated from the same table the cells are
 * painted from, so the two cannot drift.
 *
 * Every member is the SERVER'S word. `degraded` in particular is "never
 * inferred client-side" (endpoints.ts:678): no cell reads an empty `lines[]` or
 * a false `read_in_full` and concludes the scan was bad — that is the same
 * conflation `NOT_PRESENT` / `PRESENT_UNREADABLE` exists to prevent
 * (INVARIANT 7).
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
 * A 12x18 block can carry no text, so the whole sentence lives in `title` and
 * in the accessible name — which is also how the reference app does it.
 */
export function cellLabel(n: number, page: SourcePage | undefined): string {
  if (page === undefined) return `Page ${n} — no reader read this page`;
  if (page.degraded) return `Page ${n} — ${page.kind} · the server marked this scan degraded`;
  if (!page.read_in_full) return `Page ${n} — ${page.kind} · not read in full`;
  return `Page ${n} — ${page.kind} · read`;
}

/*
 * THE FILLS ARE TINTS, NOT SURFACES. Measured: the surface tokens
 * `CoverageSpine` uses read fine as a 30px spine and are invisible at 12x18 on
 * a white card — the whole matrix rendered as a blank row of hairlines, and a
 * coverage map nobody can see is worse than none. So each state takes the
 * strongest member of its own family that is still a tint;
 * `--color-state-halt-muted` is the value the reference app fills degraded
 * blocks with, and `--color-surface-app` its unreached page.
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
