import { describe, expect, test } from "vitest";
import { railBadgeClasses } from "./RailBadge";

/**
 * The badge exists because the export builds door badges and flow badges from
 * ONE factory with a `tone` argument. One copy exists today; the second
 * consumer must not become a second copy, and the tones must not quietly
 * collapse into one grey pill the way the no-value renders once did.
 */
describe("the rail badge keeps its three tones apart", () => {
  test("every tone produces a DIFFERENT class list", () => {
    const seen = new Map<string, string>();
    for (const tone of ["neutral", "attend", "halt"] as const) {
      const classes = railBadgeClasses({ tone });
      const clash = seen.get(classes);
      expect(clash, `${tone} renders identically to ${clash}`).toBeUndefined();
      seen.set(classes, tone);
    }
    expect(seen.size).toBe(3);
  });

  test("neutral is the default — a badge never colours itself", () => {
    expect(railBadgeClasses({})).toBe(railBadgeClasses({ tone: "neutral" }));
  });

  test("the pill keeps its mono numeral and its right-hand dock", () => {
    expect(railBadgeClasses({})).toContain("font-mono");
    expect(railBadgeClasses({})).toContain("ml-auto");
  });
});
