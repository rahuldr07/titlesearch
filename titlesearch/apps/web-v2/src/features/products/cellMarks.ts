import type { LineApplication } from "@titlepipe/contract";

/**
 * How the three applications are DRAWN. Presentation only — the values are the
 * server's (`LineApplication`), and nothing here decides which one a cell has.
 *
 * The marks stay distinguishable without colour — a filled disc, a half disc
 * and a dash — because this grid is the one place where "applies" and
 * "narrowed" being confused changes what a search is required to cover.
 *
 * Three states, never two: "narrowed" is not a soft yes.
 */
export const CELL_MARKS: readonly {
  value: LineApplication;
  symbol: string;
  label: string;
}[] = [
  { value: "applies", symbol: "●", label: "applies" },
  { value: "narrowed", symbol: "◐", label: "narrowed" },
  { value: "excluded", symbol: "—", label: "excluded" },
];

const LABEL: Readonly<Record<LineApplication, string>> = {
  applies: "applies",
  narrowed: "narrowed",
  excluded: "excluded",
};

export const applicationLabel = (value: LineApplication): string => LABEL[value];

/**
 * A product absent from a line's `cells` map is EXCLUDED, not unknown. That is
 * the design's own default: a new product starts not applicable for every line
 * and opts in deliberately, so a missing cell can never read as an obligation
 * nobody agreed to.
 */
export const applicationFor = (
  cells: Readonly<Record<string, LineApplication>>,
  productId: string,
): LineApplication => cells[productId] ?? "excluded";
