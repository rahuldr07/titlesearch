import { describe, expect, test } from "vitest";
import type { FieldReading } from "@titlepipe/contract";
import { lineFragmentField, threeReadingField, demoFields } from "@titlepipe/mocks";
import { nominatedPair, readingComparison, readingsDisagree } from "./readings";

/**
 * `Field.readings` IS NOT A NOMINATED PAIR, AND THESE TESTS ARE THE ONLY
 * THING SAYING SO.
 *
 * Three defects lived here undetected because every `demoFields` fixture
 * carries exactly two readings from two distinct engines:
 *
 *   D1  disagreement was derived from array cardinality + value inequality,
 *       so one engine's two LINE FRAGMENTS of one value (contract
 *       entities.ts:25) raised a false "A≠B" on the row (FieldRow.tsx) and
 *       "ENGINES DISAGREE" in the panel (panelRubric.ts) — a ruling the
 *       server never made, from a payload it never claimed anything about.
 *   D2  `nominatedPair` destructured `[a, b]` and dropped the 3rd+ reading
 *       silently. Nothing in `services/core-api` nominates a pair: there is
 *       no readings query or serializer at all, and no `(field_id,
 *       engine_id)` unique constraint on the skeleton table.
 *   D3  `ReadingPair` addresses each seat by `engine_id` (attribution and
 *       `data-testid`); the same engine in both seats made both ambiguous.
 *
 * The fixtures are asserted here too, because the defects were invisible
 * exactly as long as the fixture set was uniform.
 */

function reading(engine: string, value: string | null): FieldReading {
  return {
    id: `r-${engine}-${value ?? "null"}`,
    field_id: "f-1",
    engine_id: engine,
    value,
    page: 1,
    snippet: null,
    confidence_raw: null,
    cost_usd: 0,
    latency_ms: 0,
    line_coords: null,
  };
}

describe("the fixture set can express a non-pair payload", () => {
  test("a >=3-reading field exists", () => {
    expect(threeReadingField.readings).toHaveLength(3);
    expect(new Set(threeReadingField.readings?.map((r) => r.engine_id)).size).toBe(3);
  });

  test("a two-readings-one-engine field exists", () => {
    expect(lineFragmentField.readings).toHaveLength(2);
    expect(new Set(lineFragmentField.readings?.map((r) => r.engine_id)).size).toBe(1);
    // The values differ: they are fragments, which is what made the old
    // cardinality rule call this a disagreement.
    const [a, b] = lineFragmentField.readings ?? [];
    expect(a?.value).not.toEqual(b?.value);
  });

  test("the demo order's own fields are untouched by the additions", () => {
    // The non-pair fixtures must not join `demoFields` — queue length and the
    // per-state counts are asserted across the Playwright suite.
    const ids = demoFields.map((f) => f.id);
    expect(ids).not.toContain(threeReadingField.id);
    expect(ids).not.toContain(lineFragmentField.id);
  });
});

describe("readingComparison", () => {
  test("fewer than two readings is nothing to compare", () => {
    expect(readingComparison([]).kind).toBe("none");
    expect(readingComparison([reading("a", "X")]).kind).toBe("none");
  });

  test("two engines, differing values, is a pair that disagrees", () => {
    const c = readingComparison([reading("a", "X"), reading("b", "Y")]);
    expect(c).toMatchObject({ kind: "pair", disagree: true });
  });

  test("two engines, equal values, is a pair that agrees", () => {
    const c = readingComparison([reading("a", "X"), reading("b", "X")]);
    expect(c).toMatchObject({ kind: "pair", disagree: false });
  });

  test("D1 — two fragments from ONE engine is not a comparison", () => {
    const c = readingComparison(lineFragmentField.readings ?? []);
    expect(c.kind).toBe("not-comparable");
    if (c.kind === "not-comparable") expect(c.engines).toBe(1);
  });

  test("D2 — three readings is not a comparison, and holds all three", () => {
    const c = readingComparison(threeReadingField.readings ?? []);
    expect(c.kind).toBe("not-comparable");
    if (c.kind === "not-comparable") {
      expect(c.readings).toHaveLength(3);
      expect(c.engines).toBe(3);
    }
  });
});

describe("readingsDisagree", () => {
  test("true only where two distinct engines returned different values", () => {
    expect(readingsDisagree([reading("a", "X"), reading("b", "Y")])).toBe(true);
  });

  test("D1 — one engine's two line fragments raise no disagreement chip", () => {
    // The regression: cardinality + value inequality said `true` here, and
    // that boolean reached FieldRow's row chip and panelRubric's
    // "ENGINES DISAGREE" rubric.
    expect(readingsDisagree(lineFragmentField.readings ?? [])).toBe(false);
  });

  test("D2 — three differing readings raise no two-engine disagreement", () => {
    // Not a claim that they agreed; the UI has no standing to name which two
    // of three are "A" and "B", so it makes no A≠B claim at all.
    expect(readingsDisagree(threeReadingField.readings ?? [])).toBe(false);
  });

  test("a null value is a value for comparison purposes", () => {
    expect(readingsDisagree([reading("a", "X"), reading("b", null)])).toBe(true);
  });
});

describe("nominatedPair", () => {
  test("returns the two readings where the payload holds a two-engine pair", () => {
    const pair = nominatedPair([reading("a", "X"), reading("b", "Y")]);
    expect(pair?.a.engine_id).toBe("a");
    expect(pair?.b.engine_id).toBe("b");
  });

  test("D2 — refuses rather than silently dropping the third reading", () => {
    expect(nominatedPair(threeReadingField.readings ?? [])).toBeNull();
  });

  test("D3 — never hands ReadingPair the same engine in both seats", () => {
    expect(nominatedPair(lineFragmentField.readings ?? [])).toBeNull();
  });

  test("every pair it returns carries two distinct engine ids", () => {
    // The invariant ReadingPair's per-engine testid and attribution stand on.
    const payloads: readonly (readonly FieldReading[])[] = [
      ...demoFields.map((f) => f.readings ?? []),
      threeReadingField.readings ?? [],
      lineFragmentField.readings ?? [],
    ];
    for (const readings of payloads) {
      const pair = nominatedPair(readings);
      if (pair !== null) expect(pair.a.engine_id).not.toEqual(pair.b.engine_id);
    }
  });
});
