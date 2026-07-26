import { describe, expect, test } from "vitest";
import {
  diffChars,
  readingsDiffer,
} from "./src/entities/field/charDiff.ts";

/**
 * Orphan rule O12 — differing characters between two engine readings are
 * highlighted. The alignment is the part that can be subtly wrong, so it is
 * pinned here in node rather than only through the DOM.
 */

const marked = (segs: readonly { text: string; same: boolean }[]) =>
  segs
    .filter((s) => !s.same)
    .map((s) => s.text)
    .join("|");

const rebuilt = (segs: readonly { text: string; same: boolean }[]) =>
  segs.map((s) => s.text).join("");

describe("diffChars", () => {
  test("identical readings mark nothing", () => {
    const d = diffChars("SOUTHSTONE", "SOUTHSTONE");
    expect(marked(d.a)).toBe("");
    expect(marked(d.b)).toBe("");
  });

  test("the OCR zero-for-O substitution is isolated to the digits", () => {
    // the real fixture case
    const d = diffChars("SOUTHSTONE MORTGAGE LLC", "S0UTHST0NE M0RTGAGE LLC");
    expect(marked(d.a)).toBe("O|O|O");
    expect(marked(d.b)).toBe("0|0|0");
  });

  test("a transposition highlights minimally, not the whole amount", () => {
    // $202,224 vs $220,224 — the HANDOFF §2 seed defect. A transposition is a
    // ONE-character edit per side (delete a 0, insert a 2), so a correct
    // alignment marks one character each — not the pair, and emphatically not
    // the rest of the number. The point of the highlight is that the eye lands
    // on the divergence; marking more than the minimum defeats it.
    const d = diffChars("$202,224.00", "$220,224.00");
    // exactly one character marked on each side — the zero, which moved
    expect(marked(d.a).replace(/\|/g, "")).toBe("0");
    expect(marked(d.b).replace(/\|/g, "")).toBe("0");
    // and the shared tail stays unmarked, which is what a naive index-by-index
    // compare would ruin: it would flag everything from the transposition on
    for (const side of [d.a, d.b]) {
      const last = side.at(-1);
      expect(last?.same).toBe(true);
      expect(last?.text.endsWith(",224.00")).toBe(true);
    }
  });

  test("a single-character insertion does NOT cascade", () => {
    // the failure mode of a naive index-by-index compare: everything after the
    // insertion would be flagged, burying the actual difference in noise
    const d = diffChars("MARIA ESTRADA", "MARIA L ESTRADA");
    expect(marked(d.a)).toBe("");
    expect(marked(d.b).trim()).toBe("L");
  });

  test("segments always reconstruct the original strings exactly", () => {
    const pairs: [string, string][] = [
      ["MARIA L. ESTRADA", "MARIA I. ESTRADA"],
      ["2011-0043187", "2011-0043781"],
      ["", "SOMETHING"],
      ["SOMETHING", ""],
      ["", ""],
    ];
    for (const [a, b] of pairs) {
      const d = diffChars(a, b);
      expect(rebuilt(d.a)).toBe(a);
      expect(rebuilt(d.b)).toBe(b);
    }
  });

  test("a wholly different reading marks everything", () => {
    const d = diffChars("AAA", "BBB");
    expect(marked(d.a)).toBe("AAA");
    expect(marked(d.b)).toBe("BBB");
  });
});

describe("readingsDiffer", () => {
  test("two distinct values disagree", () => {
    expect(readingsDiffer(["SOUTHSTONE", "S0UTHST0NE"])).toBe(true);
  });

  test("identical values agree", () => {
    expect(readingsDiffer(["30296", "30296"])).toBe(false);
  });

  test("nulls are ignored, not treated as a distinct value", () => {
    // an engine that returned nothing is not "a second opinion that differs"
    expect(readingsDiffer(["30296", null])).toBe(false);
    expect(readingsDiffer([null, null])).toBe(false);
  });

  test("a single reading cannot disagree with itself", () => {
    expect(readingsDiffer(["30296"])).toBe(false);
    expect(readingsDiffer([])).toBe(false);
  });
});
