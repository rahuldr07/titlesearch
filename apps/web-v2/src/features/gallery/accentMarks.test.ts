import { describe, expect, test } from "vitest";
import { GALLERY_ACCENTS, accentMark } from "./accentMarks";
import { GALLERY_STATES } from "./galleryStates";

/**
 * THE GALLERY MUST SURVIVE HAVING ITS COLOUR TAKEN AWAY.
 *
 * These assert a PROPERTY, not today's four glyphs. `tokens.css` measures
 * settled and attend at 1.16:1 apart in greyscale — i.e. indistinguishable — and
 * hands the distinction to chip form. This is the gate on that promise: a fifth
 * register, or a glyph quietly reused, fails here rather than shipping a
 * catalogue that claims to show four states and shows three.
 *
 * Pinned to `GALLERY_ACCENTS` rather than a literal list so the check grows with
 * the union instead of going stale beside it.
 */
describe("every severity register is separable without colour", () => {
  test("each register has a mark", () => {
    for (const accent of GALLERY_ACCENTS) {
      expect(accentMark(accent), accent).toBeTruthy();
    }
  });

  test("no two registers share a mark", () => {
    const marks = GALLERY_ACCENTS.map(accentMark);
    expect(new Set(marks).size).toBe(marks.length);
  });

  test("no mark is a letter or a digit — those read as text, not as a signal", () => {
    // A badge is words plus a mark. A mark made of the same alphabet as the
    // words beside it stops being a second channel and becomes a typo.
    for (const accent of GALLERY_ACCENTS) {
      expect(accentMark(accent), accent).not.toMatch(/[a-z0-9]/i);
    }
  });

  test("the union is total — an unhandled register throws rather than blanking", () => {
    // The `never` guard, exercised. An empty mark is precisely the collapse this
    // module prevents, and it would ship silently if the default returned "".
    // rules-allow: casting an off-union value is the only way to reach the guard
    expect(() => accentMark("teal" as (typeof GALLERY_ACCENTS)[number])).toThrow(
      /Unhandled gallery accent/,
    );
  });

  test("every catalogue entry uses a register the mark table knows", () => {
    // Guards the other direction: a card carrying an accent outside the union
    // would render an unmarked block, which is the collapse wearing a new hat.
    const known = new Set<string>(GALLERY_ACCENTS);
    for (const state of GALLERY_STATES) {
      expect(known.has(state.accent), `${state.id} has accent ${state.accent}`).toBe(
        true,
      );
    }
  });

  test("the three that used to collapse now carry three different marks", () => {
    // The specific defect, named: `Closed · added` (settled), `Closed · amended`
    // (action) and `Note only` (attend) drew as one rectangle in greyscale.
    const collapsed = ["settled", "action", "attend"] as const;
    const marks = collapsed.map(accentMark);
    expect(new Set(marks).size).toBe(3);
  });
});
