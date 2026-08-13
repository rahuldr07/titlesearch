import { describe, expect, it } from "vitest";
import { offersExclude } from "./excludeGate";

/**
 * BLOCKER 3. `✕ Not our party` is offered only where party identity IS the
 * question (rulebook R13). The BUTTON honoured that; the `x` chord did not —
 * it opened the exclude editor on any field at all, and an excluded row is
 * GONE (`conflicts.md` C18).
 *
 * One predicate, read by both the button and the chord. Two copies of a
 * rulebook gate is how one of them ends up not being a gate.
 */
describe("offersExclude", () => {
  it("offers suppression on judgment party rows", () => {
    expect(offersExclude("judgments.1.plaintiff")).toBe(true);
    expect(offersExclude("judgments.1.plaintiff_attorney")).toBe(true);
    expect(offersExclude("judgments.12.case_no")).toBe(true);
  });

  it("refuses every field where party identity is not the question", () => {
    for (const path of [
      "owner.zip",
      "owner.names",
      "mortgages.1.lender",
      "deed.grantor",
      "assessment.total",
      "legal.plat_book_page",
    ]) {
      expect(offersExclude(path)).toBe(false);
    }
  });

  it("is not fooled by a path that merely mentions judgments", () => {
    // `startsWith` on the segment, not a substring search anywhere in the path.
    expect(offersExclude("deed.judgments_note")).toBe(false);
    expect(offersExclude("judgmentsummary.1.plaintiff")).toBe(false);
  });
});
