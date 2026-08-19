import { describe, expect, test } from "vitest";
import type { SourcePage } from "@titlepipe/contract";
import {
  CELL_LABEL,
  cellClasses,
  classifyPage,
  coverageCells,
  coverageCounts,
} from "./pageCoverage";

const page = (n: number, over: Partial<SourcePage> = {}): SourcePage => ({
  n,
  read_in_full: true,
  kind: "WARRANTY DEED",
  lines: [],
  degraded: false,
  ...over,
});

/**
 * The spine answers "what have I NOT looked at". A list of the pages a reader
 * typed cannot: seven chips out of sixty-four have no representation at all for
 * the other fifty-seven, which reads as "the package has seven pages".
 */
describe("every package page gets a cell", () => {
  test("cells are drawn for the total, not for the served list", () => {
    const cells = coverageCells(64, [page(3), page(7)]);
    expect(cells).toHaveLength(64);
    expect(cells.filter((c) => c.tier === "unseen")).toHaveLength(62);
  });

  test("the counts sum to the package", () => {
    const counts = coverageCounts(
      coverageCells(64, [page(3), page(7, { degraded: true })]),
    );
    expect(counts.read + counts.degraded + counts.partial + counts.unseen).toBe(64);
  });

  test("a served page beyond the total is not drawn — the total is the server's", () => {
    const cells = coverageCells(4, [page(9)]);
    expect(cells).toHaveLength(4);
    expect(cells.every((c) => c.tier === "unseen")).toBe(true);
  });
});

describe("the four tiers never collapse", () => {
  test("classification consults degraded only once read in full", () => {
    expect(classifyPage(undefined)).toBe("unseen");
    expect(classifyPage(page(1, { read_in_full: false, degraded: true }))).toBe("partial");
    expect(classifyPage(page(1, { degraded: true }))).toBe("degraded");
    expect(classifyPage(page(1))).toBe("read");
  });

  test("every tier produces a DIFFERENT class list", () => {
    const seen = new Map<string, string>();
    for (const tier of ["read", "degraded", "partial", "unseen"] as const) {
      const classes = cellClasses({ tier });
      expect(seen.get(classes), `${tier} duplicates another tier`).toBeUndefined();
      seen.set(classes, tier);
    }
    expect(seen.size).toBe(4);
  });

  test("the distinction survives greyscale — unseen is dashed, not merely pale", () => {
    // Same rule as the no-value renders: colour is secondary, border style and
    // fill carry the distinction.
    expect(cellClasses({ tier: "unseen" })).toContain("border-dashed");
    expect(cellClasses({ tier: "partial" })).not.toContain("border-dashed");
  });

  /**
   * The export's `need` and `cited` tiers are a browser-side join over
   * `Field.source_page` + `Field.state`. Coverage tiers are the server's, so
   * the union stays at four until `OrderPagesResponse` carries more.
   */
  test("the tier vocabulary is four, not the export's six", () => {
    expect(Object.keys(CELL_LABEL)).toHaveLength(4);
    expect(Object.keys(CELL_LABEL)).not.toContain("cited");
    expect(Object.keys(CELL_LABEL)).not.toContain("needs_you");
  });

  test("every tier is named — a square with no words is not a state", () => {
    for (const tier of ["read", "degraded", "partial", "unseen"] as const) {
      expect(CELL_LABEL[tier].length).toBeGreaterThan(0);
    }
  });
});
