import { describe, expect, test } from "vitest";
// Relative .ts imports (not the workspace aliases): this file typechecks under
// tsconfig.node.json (nodenext), where the aliases would need emitted
// declarations the source-only packages don't produce. Same reason as
// authz.test.ts.
import {
  describeNoValue,
  noValueOf,
  type NoValue,
} from "./src/entities/field/noValue.ts";
import { NaReason } from "../../packages/contract/src/enums.ts";

/**
 * The four-state NA rule, pinned as a static gate.
 *
 * CONTEXT §11 and the ratified Q1 ruling: four no-value states that render
 * distinctly and route oppositely, plus "not yet extracted" as a fifth,
 * separate render. Collapsing any of them sends reviewers chasing ghosts.
 *
 * These run in node — no DOM needed — because the vocabulary is deliberately
 * pure. The RENDERING of each state is covered by the harvested e2e
 * invariants once the Review screen lands.
 */

const ALL: NoValue[] = [
  { kind: "pending" },
  { kind: "not_present" },
  { kind: "not_found" },
  { kind: "not_stated" },
  { kind: "unreadable", page: 7 },
];

describe("the four NA states never collapse", () => {
  test("every contract NaReason member maps to its own kind", () => {
    const kinds = NaReason.options.map((r) =>
      noValueOf({ value: null, na_reason: r, source_page: 3 }),
    );
    expect(kinds.map((k) => k?.kind)).toEqual([
      "not_present",
      "not_found",
      "not_stated",
      "unreadable",
    ]);
    // four distinct kinds, no duplicates — the collapse would show up here
    expect(new Set(kinds.map((k) => k?.kind)).size).toBe(4);
  });

  test("the contract ships exactly the four ratified members", () => {
    expect([...NaReason.options].sort()).toEqual([
      "NOT_FOUND",
      "NOT_PRESENT",
      "NOT_STATED",
      "PRESENT_UNREADABLE",
    ]);
  });

  test("all five renders are distinct in label and testId", () => {
    const d = ALL.map(describeNoValue);
    expect(new Set(d.map((x) => x.label)).size).toBe(5);
    expect(new Set(d.map((x) => x.testId)).size).toBe(5);
  });
});

describe("pending is not an NA state", () => {
  test("a null value with no na_reason is pending, never Not Available", () => {
    const v = noValueOf({ value: null, na_reason: null });
    expect(v).toEqual({ kind: "pending" });
    const label = describeNoValue({ kind: "pending" }).label;
    expect(label).toBe("not yet extracted");
    // the exact collapse this rule exists to prevent
    expect(label.toLowerCase()).not.toContain("not available");
    expect(label.toLowerCase()).not.toContain("n/a");
  });

  test("pending is not a member of the contract's NaReason", () => {
    expect([...NaReason.options]).not.toContain("PENDING");
    expect(describeNoValue({ kind: "pending" }).tone).toBe("pipeline");
  });
});

describe("routing meaning is preserved per state", () => {
  test("NOT_PRESENT is quiet — it is correct, and never prompts action", () => {
    expect(describeNoValue({ kind: "not_present" }).tone).toBe("quiet");
  });

  test("a real gap in the record is surfaced", () => {
    expect(describeNoValue({ kind: "not_found" }).tone).toBe("surfaced");
    expect(describeNoValue({ kind: "not_stated" }).tone).toBe("surfaced");
  });

  test("unreadable is the loudest, and the only one that cites a page", () => {
    expect(describeNoValue({ kind: "unreadable", page: 7 }).tone).toBe("halt");
    for (const v of ALL) {
      expect(describeNoValue(v).carriesPage).toBe(v.kind === "unreadable");
    }
  });
});

describe("a field that has a value is not a no-value", () => {
  test("noValueOf returns null so the caller renders the value", () => {
    expect(noValueOf({ value: "30296", na_reason: null })).toBeNull();
  });

  test("an na_reason wins even if a value came along with it", () => {
    // the server said unreadable; the UI does not second-guess it by
    // preferring whatever partial string arrived alongside
    expect(
      noValueOf({ value: "3?2?6", na_reason: "PRESENT_UNREADABLE", source_page: 9 }),
    ).toEqual({ kind: "unreadable", page: 9 });
  });
});

describe("exhaustiveness", () => {
  test("an unknown kind throws rather than rendering a silent blank", () => {
    expect(() =>
      describeNoValue({ kind: "invented" } as unknown as NoValue),
    ).toThrow(/unhandled no-value kind/);
  });

  test("an unknown na_reason throws rather than falling through", () => {
    expect(() =>
      noValueOf({ value: null, na_reason: "MADE_UP" as never }),
    ).toThrow(/unhandled na_reason/);
  });
});
