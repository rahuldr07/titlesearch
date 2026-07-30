import { describe, expect, test } from "vitest";
import type { Door } from "./doors";
import { railGlyphs } from "./glyphs";

/**
 * The tie-break itself, exercised on a synthetic set so the properties are
 * pinned independently of today's catalogue: distinctness, first-claim-wins,
 * and stability when a door is added.
 */
const door = (path: string, key: string, label: string): Door => ({
  path,
  key,
  label,
  group: "work",
});

const CATALOGUE: Door[] = [
  door("/products", "t", "products & sign-off"),
  door("/people", "m", "people"),
  door("/queue", "q", "queue"),
];

describe("no two doors in one rail draw the same square", () => {
  test("the first claim keeps the initial; the loser draws its chord", () => {
    const glyphs = railGlyphs(CATALOGUE);
    expect(glyphs.get("/products")).toBe("P");
    expect(glyphs.get("/people")).toBe("M");
    expect(glyphs.get("/queue")).toBe("Q");
  });

  test("a label that opens on a digit draws its first LETTER, not the digit", () => {
    const glyphs = railGlyphs([door("/v2", "z", "2026 review")]);
    expect(glyphs.get("/v2")).toBe("R");
  });

  test("a label with no letter at all still gets a mark — its chord", () => {
    const glyphs = railGlyphs([door("/v2", "z", "2026")]);
    expect(glyphs.get("/v2")).toBe("Z");
  });

  test("when the chord is taken too, a later letter of its own label carries it", () => {
    // "mailroom" wants M — spent as People's fallback — and its chord `p` is
    // Products'. A is the next letter of its OWN label that is free, so even
    // the third choice stays derived from the label rather than invented.
    const glyphs = railGlyphs([...CATALOGUE, door("/mail", "p", "mailroom")]);
    expect(glyphs.get("/mail")).toBe("A");
    expect(new Set([...glyphs.values()]).size).toBe(4);
    // And the settled doors did NOT move to make room for it.
    expect(glyphs.get("/people")).toBe("M");
  });

  test("ADDING A DOOR NEVER MOVES AN EXISTING ONE", () => {
    const before = railGlyphs(CATALOGUE);
    const after = railGlyphs([...CATALOGUE, door("/pricing", "y", "pricing")]);
    for (const [path, glyph] of before) expect(after.get(path)).toBe(glyph);
    expect(after.get("/pricing")).toBe("Y");
  });

  test("it is a pure function of the door set — same input, same output", () => {
    expect([...railGlyphs(CATALOGUE)]).toEqual([...railGlyphs([...CATALOGUE])]);
  });

  test("it refuses to invent a duplicate when the alphabet runs out", () => {
    const many = Array.from({ length: 27 }, (_, i) => door(`/d${i}`, "q", "queue"));
    expect(() => railGlyphs(many)).toThrow(/no distinct rail glyph/);
  });
});
