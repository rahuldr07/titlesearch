import type { SourcePage } from "@titlepipe/contract";

/**
 * The four paints a matrix cell can take; the legend is generated from the
 * same table the cells are painted from, so the two cannot drift.
 *
 * Every member is the server's word — `degraded` is never inferred client-side
 * from an empty `lines[]` or a false `read_in_full`. A page with no entry in
 * `pages[]` is a page nobody read, not a page that does not exist: the
 * response is a sample of the package.
 */
export type CellState = "read" | "partial" | "degraded" | "unread";

export function stateOf(page: SourcePage | undefined): CellState {
  if (page === undefined) return "unread";
  if (page.degraded) return "degraded";
  if (!page.read_in_full) return "partial";
  return "read";
}

/**
 * The block carries no text, so the whole sentence lives in `title` and the
 * accessible name.
 */
export function cellLabel(n: number, page: SourcePage | undefined): string {
  if (page === undefined) return `Page ${n} — no reader read this page`;
  if (page.degraded) return `Page ${n} — ${page.kind} · the server marked this scan degraded`;
  if (!page.read_in_full) return `Page ${n} — ${page.kind} · not read in full`;
  return `Page ${n} — ${page.kind} · read`;
}

/*
 * Tints, not surfaces: the surface tokens `CoverageSpine` uses are invisible
 * at 12x18 on a white card — the matrix would render as a blank row of
 * hairlines. Each state takes the strongest member of its family that is
 * still a tint.
 */
export const PAINT: Readonly<Record<CellState, string>> = {
  read: "border-scan-line bg-scan",
  partial: "border-dashed border-scan-line bg-surface-paper",
  degraded: "border-state-halt-border bg-state-halt-muted",
  unread: "border-line-strong bg-surface-app",
};

/** The legend row, in the order a reader meets the states. */
export const LEGEND: readonly { readonly state: CellState; readonly label: string }[] = [
  { state: "read", label: "Read" },
  { state: "partial", label: "Not read in full" },
  { state: "degraded", label: "Degraded scan" },
  { state: "unread", label: "Nobody read it" },
];
