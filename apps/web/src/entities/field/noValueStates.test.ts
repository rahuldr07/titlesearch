import { describe, expect, test } from "vitest";
import { NaReason } from "@titlepipe/contract";
import { NO_VALUE, type NoValueRender } from "./noValueStates";

/**
 * The five no-value renders must never collapse into one grey dash. Kept
 * DOM-free so the exhaustiveness is provable without a browser; the rendered
 * half lives in NoValueChip.stories.tsx.
 */

const RENDERS: readonly NoValueRender[] = [...NaReason.options, "not-extracted"];

describe("the five no-value renders", () => {
  test("there are exactly five, and the fifth is not an NA reason", () => {
    expect(RENDERS).toHaveLength(5);
    // "not-extracted" is a statement about the pipeline, not an NA reason.
    expect(NaReason.options).not.toContain("not-extracted");
    expect(Object.keys(NO_VALUE).sort()).toEqual([...RENDERS].sort());
  });

  test("every render has its own sentence", () => {
    const sentences = RENDERS.map((r) => NO_VALUE[r].sentence);
    expect(new Set(sentences).size).toBe(5);
    // A dash, an empty string or an "n/a" is the collapse this test exists for.
    for (const sentence of sentences) {
      expect(sentence.length).toBeGreaterThan(8);
      expect(sentence).not.toMatch(/^[-—–\s]*$/);
    }
  });

  /**
   * Colour alone does not carry the distinction — each render has a border
   * style and a fill, which is what survives greyscale and a red-green
   * deficiency. Two renders sharing an ink is legal; sharing an ink and a
   * border style is the collapse.
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
   * The routing half, copied from the contract's enums rather than decided
   * here — must stay in sync with enums.ts. NOT_PRESENT is correct and never
   * surfaced for review; a flipped boolean sends reviewers chasing ghosts.
   */
  test("surfacing follows the rulebook, not the value being null", () => {
    expect(NO_VALUE.NOT_PRESENT.surfacedForReview).toBe(false);
    expect(NO_VALUE.NOT_FOUND.surfacedForReview).toBe(true);
    expect(NO_VALUE.NOT_STATED.surfacedForReview).toBe(true);
    expect(NO_VALUE.PRESENT_UNREADABLE.surfacedForReview).toBe(true);
    // A pipeline statement is not a reviewer's ask either.
    expect(NO_VALUE["not-extracted"].surfacedForReview).toBe(false);
  });

  /** The closed glyph vocabulary — no emoji, no icons. */
  test("every mark comes from the glyph vocabulary", () => {
    for (const render of RENDERS) {
      expect(["✓", "◆", "•"]).toContain(NO_VALUE[render].mark);
    }
  });
});
