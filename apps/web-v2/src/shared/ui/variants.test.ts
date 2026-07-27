import { describe, expect, test } from "vitest";
import { buttonClasses } from "./Button";
import { noValueClasses } from "../../entities/field/NoValue";

/**
 * These exist because a mutation audit killed nothing.
 *
 * Six plausible bugs were injected and the suite reported 141/141 passing on
 * every one. Two of them lived here: deleting every `disabled:` class from
 * Button, and collapsing all six no-value renders into one identical grey.
 * The second is the CONTEXT §11 release blocker verbatim — "they must never
 * collapse into one grey dash" — and nothing noticed, because the ten existing
 * no-value tests assert the STRINGS in `describeNoValue`, never the RENDER.
 *
 * A `cva` config is a pure function from variant to class list. Testing it in
 * node needs no DOM and catches exactly the class of regression that slipped
 * through: styling logic silently losing a distinction.
 *
 * What this cannot do is prove the classes have the intended VISUAL effect —
 * that is axe's job on the Storybook run, and the two are complements.
 */

const NA_KINDS = [
  "pending",
  "unsettled",
  "not_present",
  "not_found",
  "silent",
  "unreadable",
] as const;

describe("the six no-value renders never collapse", () => {
  test("every kind produces a DIFFERENT class list", () => {
    const seen = new Map<string, string>();
    for (const kind of NA_KINDS) {
      const classes = noValueClasses({ kind });
      const clash = seen.get(classes);
      expect(
        clash,
        `${kind} renders identically to ${clash} — CONTEXT §11: they must never collapse into one grey dash`,
      ).toBeUndefined();
      seen.set(classes, kind);
    }
    expect(seen.size).toBe(NA_KINDS.length);
  });

  test("the distinction survives greyscale — each differs by more than colour", () => {
    // Colour alone fails for colour-blind and greyscale-printed readers, so
    // every kind must also differ in border-style or fill pattern.
    const structural = (kind: (typeof NA_KINDS)[number]) =>
      noValueClasses({ kind })
        .split(/\s+/)
        .filter((c) => /border-dashed|border-solid|na-hatch|^border$|bg-/.test(c))
        .sort()
        .join(" ");

    // not_present is dashed, silent is hatched, unreadable is tinted — the
    // three that must never be mistaken for one another.
    expect(structural("not_present")).not.toBe(structural("not_found"));
    expect(structural("silent")).not.toBe(structural("not_found"));
    expect(structural("unreadable")).not.toBe(structural("not_found"));
  });

  test("the two pipeline states are not styled as NA states", () => {
    // pending and unsettled say "no answer yet", not "the document says no".
    for (const kind of ["pending", "unsettled"] as const) {
      expect(noValueClasses({ kind })).toContain("state-attend");
    }
    for (const kind of ["not_present", "not_found", "silent"] as const) {
      expect(noValueClasses({ kind })).not.toContain("state-attend");
    }
  });
});

describe("Button's disabled treatment is a surface swap, never opacity", () => {
  test("every variant carries the disabled classes", () => {
    // Deleting these was mutation M4 and nothing failed. The design's rule is
    // that disabled swaps surface/ink/border; opacity means something else
    // entirely here (permission-denied and retired).
    for (const fill of ["solid", "outlined", "tinted", "ghost"] as const) {
      const classes = buttonClasses({ fill, tone: "neutral" });
      expect(classes, `${fill} lost disabled:bg`).toContain("disabled:bg-surface-app");
      expect(classes, `${fill} lost disabled:text`).toContain("disabled:text-ink-muted");
      expect(classes, `${fill} lost the cursor`).toContain("disabled:cursor-not-allowed");
    }
  });

  test("disabled never uses opacity", () => {
    for (const fill of ["solid", "outlined", "tinted", "ghost"] as const) {
      expect(buttonClasses({ fill })).not.toMatch(/disabled:opacity/);
    }
  });

  test("each tone/fill pair is visually distinct", () => {
    const seen = new Set<string>();
    for (const fill of ["solid", "outlined", "tinted"] as const) {
      for (const tone of ["action", "settled", "attend", "halt"] as const) {
        const c = buttonClasses({ fill, tone });
        expect(seen.has(c), `${fill}/${tone} duplicates another variant`).toBe(false);
        seen.add(c);
      }
    }
  });

  test("the design's transition-free rule holds", () => {
    expect(buttonClasses({})).toContain("transition-none");
  });
});
