import { describe, expect, test } from "vitest";
import { NaReason } from "@titlepipe/contract";
import { NO_VALUE, type NoValueRender } from "./noValueStates";

/**
 * "THEY MUST NEVER COLLAPSE INTO ONE GREY DASH."
 *
 * That sentence appears in `enums.ts`, in AGENTS.md, in CONTEXT §11 and on a
 * card in the design's own States Gallery. Four statements of a rule is what a
 * rule looks like just before it gets broken, so it is a test.
 *
 * NODE, not the browser. `vitest.config.ts` routes `src/**\/*.test.ts` to the
 * `gates` project on purpose — "Pure-logic entity tests. Kept DOM-free on
 * purpose so rules like no-value exhaustiveness are provable without a browser."
 * The rendered proof lives in `NoValueChip.stories.tsx`, which puts all five on
 * one canvas so a reviewer can SEE it; this is the half a machine can check.
 */

const RENDERS: readonly NoValueRender[] = [...NaReason.options, "not-extracted"];

describe("the five no-value renders", () => {
  test("there are exactly five, and the fifth is not an NA reason", () => {
    expect(RENDERS).toHaveLength(5);
    // enums.ts:44-47 — NOT YET EXTRACTED is a statement about the PIPELINE.
    expect(NaReason.options).not.toContain("not-extracted");
    expect(Object.keys(NO_VALUE).sort()).toEqual([...RENDERS].sort());
  });

  test("every render has its own sentence", () => {
    const sentences = RENDERS.map((r) => NO_VALUE[r].sentence);
    expect(new Set(sentences).size).toBe(5);
    // A dash, an empty string or an "n/a" IS the collapse this test exists for.
    for (const sentence of sentences) {
      expect(sentence.length).toBeGreaterThan(8);
      expect(sentence).not.toMatch(/^[-—–\s]*$/);
    }
  });

  /**
   * `tokens.css`: "colour alone does not carry the distinction and is not asked
   * to: each has a border STYLE and a FILL … that is what survives greyscale
   * and a red-green deficiency both." So the border style is asserted
   * separately from the ink — two renders sharing an ink is legal, two sharing
   * an ink AND a border style is the collapse.
   */
  test("no two renders share both an ink and a border style", () => {
    const signatures = RENDERS.map((render) => {
      const chrome = NO_VALUE[render].chrome;
      const ink = chrome.match(/\btext-[a-z0-9-]+/)?.[0] ?? "";
      const border = chrome.match(/\bborder-(solid|dashed|dotted)\b|\btp-na-hatch\b/)?.[0] ?? "";
      expect(ink, `${render} declares no ink`).not.toBe("");
      expect(border, `${render} declares no border style or hatch`).not.toBe("");
      return `${ink}|${border}`;
    });
    expect(new Set(signatures).size).toBe(5);
  });

  /**
   * The routing half, copied from `enums.ts:31-42` rather than decided here.
   * NOT_PRESENT is "correct, and NEVER surfaced for review"; NOT_FOUND and
   * PRESENT_UNREADABLE are "always surfaced". Pinned because a screen reads
   * this to avoid re-deriving the answer, and a flipped boolean would send
   * reviewers "chasing ghosts on every California order".
   */
  test("surfacing follows the rulebook, not the value being null", () => {
    expect(NO_VALUE.NOT_PRESENT.surfacedForReview).toBe(false);
    expect(NO_VALUE.NOT_FOUND.surfacedForReview).toBe(true);
    expect(NO_VALUE.NOT_STATED.surfacedForReview).toBe(true);
    expect(NO_VALUE.PRESENT_UNREADABLE.surfacedForReview).toBe(true);
    // A pipeline statement is not a reviewer's ask either.
    expect(NO_VALUE["not-extracted"].surfacedForReview).toBe(false);
  });

  /** Rule 7's glyph vocabulary: ✓ ◆ • T1, and nothing else. No emoji, no icons. */
  test("every mark comes from the glyph vocabulary", () => {
    for (const render of RENDERS) {
      expect(["✓", "◆", "•"]).toContain(NO_VALUE[render].mark);
    }
  });
});
