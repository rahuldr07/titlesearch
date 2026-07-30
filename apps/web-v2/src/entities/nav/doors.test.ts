import { describe, expect, test } from "vitest";
import { doorGlyph, doorTitle, doorForKey, doorsFor } from "./doors";

/**
 * D2, ruled in the spec: the square shows the LABEL INITIAL and the chord moves
 * to the row title and the `?` map — a chord is learned where it is printed,
 * not from a square. `Door.key` stays the single chord source and `Door.icon`
 * stops aliasing it.
 */
describe("the door glyph is the label's initial, derived not stored", () => {
  test("the admin's rail draws the export's own initials", () => {
    const byPath = new Map(doorsFor("admin").map((door) => [door.path, doorGlyph(door)]));
    expect(byPath.get("/queue")).toBe("Q");
    expect(byPath.get("/overview")).toBe("O");
    expect(byPath.get("/rulebook")).toBe("R");
    expect(byPath.get("/products")).toBe("P");
    expect(byPath.get("/clients")).toBe("C");
    expect(byPath.get("/people")).toBe("P");
    expect(byPath.get("/audit")).toBe("A");
    expect(byPath.get("/gallery")).toBe("S");
  });

  test("a colliding initial is fine — the export renders P twice and does not care", () => {
    // The rail's plain door rows are the `work`/`admin`/`reference` groups; the
    // `this-order` doors are drawn by the numbered rail and `account` is not
    // drawn at all, so those are not part of what a reader compares.
    const RENDERED = new Set(["work", "admin", "reference"]);
    const glyphs = doorsFor("admin")
      .filter((door) => RENDERED.has(door.group))
      .map(doorGlyph);
    expect(glyphs).toEqual(["Q", "O", "E", "R", "P", "C", "P", "A", "S"]);
    // Uniqueness is NOT a rule here. A glyph that had to be unique would have
    // to stop being the label's initial, which is the drift this replaced.
    expect(glyphs.filter((g) => g === "P")).toHaveLength(2);
  });
});

describe("the chord rides the title, and the key stays the only chord source", () => {
  test("the title names the door and the chord that opens it", () => {
    const rulebook = doorsFor("admin").find((door) => door.path === "/rulebook");
    expect(rulebook && doorTitle(rulebook)).toBe("rulebook · g b");
  });

  test("the glyph is not the chord — B still opens the rulebook, R draws it", () => {
    const rulebook = doorForKey("admin", "b");
    expect(rulebook?.path).toBe("/rulebook");
    expect(rulebook && doorGlyph(rulebook)).toBe("R");
  });
});
