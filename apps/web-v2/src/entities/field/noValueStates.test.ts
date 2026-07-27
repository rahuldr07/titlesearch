import { describe, expect, test } from "vitest";
import { describeNoValue, NA_REASONS, type NoValueKind } from "./noValueStates";

/**
 * Static gate, node environment — no DOM. Pins the rule that CONTEXT §11 makes
 * a release blocker: the no-value states never collapse into one another.
 */

const ALL: NoValueKind[] = [
  { kind: "pending" },
  { kind: "unsettled" },
  { kind: "not_present" },
  { kind: "not_found" },
  { kind: "silent" },
  { kind: "unreadable", page: 47 },
];

describe("the six renders are distinct", () => {
  test("every kind resolves", () => {
    expect(ALL).toHaveLength(6);
    for (const v of ALL) expect(describeNoValue(v).label.length).toBeGreaterThan(0);
  });

  test("no two states share a visible label", () => {
    const labels = ALL.map((v) => describeNoValue(v).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("no two states share an accessible label", () => {
    // Distinctness must survive without sight, not only without colour.
    const a11y = ALL.map((v) => describeNoValue(v).accessibleLabel);
    expect(new Set(a11y).size).toBe(a11y.length);
  });

  test("nothing renders as an empty string", () => {
    for (const v of ALL) {
      const d = describeNoValue(v);
      expect(d.label.trim()).not.toBe("");
      expect(d.accessibleLabel.trim()).not.toBe("");
    }
  });
});

describe("document states are separated from pipeline states", () => {
  test("the four NaReason members are document statements", () => {
    expect([...NA_REASONS]).toEqual(["not_present", "not_found", "silent", "unreadable"]);
    for (const kind of NA_REASONS) {
      const v = (kind === "unreadable"
        ? { kind, page: 1 }
        : { kind }) as NoValueKind;
      expect(describeNoValue(v).isPipelineState).toBe(false);
    }
  });

  test("pending and unsettled are pipeline statements, not NA reasons", () => {
    expect(describeNoValue({ kind: "pending" }).isPipelineState).toBe(true);
    expect(describeNoValue({ kind: "unsettled" }).isPipelineState).toBe(true);
    expect(NA_REASONS).not.toContain("pending");
    expect(NA_REASONS).not.toContain("unsettled");
  });

  test("unsettled never reads as emptiness — orphan O8", () => {
    // `ux.spec` "a both-found disagreement never claims emptiness". Two engines
    // read the field and disagreed; saying "not found" or "not yet extracted"
    // would be a lie about a field that has two candidate values.
    const { label, accessibleLabel } = describeNoValue({ kind: "unsettled" });
    for (const text of [label, accessibleLabel.toLowerCase()]) {
      expect(text.toLowerCase()).not.toContain("not found");
      expect(text.toLowerCase()).not.toContain("not yet extracted");
      expect(text.toLowerCase()).not.toContain("n/a");
    }
    expect(accessibleLabel.toLowerCase()).toContain("disagree");
  });

  test("pending never reads as an NA state", () => {
    // server-owns-state.spec #1 and review.spec #1, both INVARIANT.
    const { label } = describeNoValue({ kind: "pending" });
    expect(label.toLowerCase()).not.toContain("not available");
    expect(label.toLowerCase()).not.toContain("n/a");
  });
});

describe("unreadable carries its page", () => {
  test("the page number reaches both labels", () => {
    const d = describeNoValue({ kind: "unreadable", page: 47 });
    expect(d.label).toContain("47");
    expect(d.accessibleLabel).toContain("47");
  });
});

describe("fail loudly, never blank", () => {
  test("an unknown kind throws rather than rendering nothing", () => {
    const rogue = { kind: "nope" } as unknown as NoValueKind; // rules-allow: the test needs an off-union value the compiler forbids constructing
    expect(() => describeNoValue(rogue)).toThrow(/Unhandled no-value kind/);
  });
});
