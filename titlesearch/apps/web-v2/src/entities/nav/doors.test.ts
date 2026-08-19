import { describe, expect, test } from "vitest";
import { ROLES, type Role } from "@titlepipe/contract";
import { canOpen, doorGlyph, doorTitle, doorForKey, doorsFor, isRailDoor } from "./doors";

/**
 * D2, RE-RULED TWICE. The rail's mark is now the mockup's stored ICON, and the
 * requirement that outlived both rulings is the one asserted hardest below: the
 * marks must be DISTINCT, because the collapsed 78px rail draws the mark and
 * nothing else, so two identical marks are two rows a reader cannot tell apart.
 *
 * History, because the reasoning is worth more than the outcome:
 *   1. The export draws the label's initial and lets Products and People both
 *      draw P. A version of this file asserted `["Q","O","E","R","P","C","P",
 *      "A","S"]` — pinning the exact failure `SidebarDoor` says it prevents.
 *   2. `glyphs.ts` replaced that with a resolver: first claim wins the initial,
 *      the loser falls back to its chord key. Correct, and it made a collision
 *      structurally impossible rather than merely tested.
 *   3. The approved mockup draws borderless pictographs, not letters. A stored
 *      icon cannot drift from a label the way a stored letter could (there is no
 *      derivation to disagree with), so the resolver had nothing left to protect
 *      — except uniqueness, which is now gated here directly.
 *
 * The gate is deliberately TOTAL over roles and over the catalogue: a door added
 * without an icon, or with one already spent, fails here rather than shipping a
 * rail with two rows that look the same.
 */
const railGlyphsFor = (role: Role): string[] =>
  doorsFor(role).filter(isRailDoor).map(doorGlyph);

describe("the rail's marks are the mockup's icons, and they are distinct", () => {
  test("every door the rail draws carries an icon — none falls back to a letter", () => {
    for (const role of ROLES) {
      for (const door of doorsFor(role).filter(isRailDoor)) {
        expect(door.icon, `${door.path} has no icon`).toBeDefined();
        // The fallback branch in `doorGlyph` is for markless groups only; a
        // drawn door reaching it would render a letter in a column of glyphs.
        expect(doorGlyph(door)).not.toMatch(/^[A-Z]$/);
      }
    }
  });

  test("the admin's rail draws the mockup's own icons, in catalogue order", () => {
    expect(railGlyphsFor("admin")).toEqual(["▤", "◫", "↗", "§", "✎", "⌂", "◉", "≡", "◈"]);
  });

  test("no two doors the collapsed rail draws share a mark, for EVERY role", () => {
    for (const role of ROLES) {
      const glyphs = railGlyphsFor(role);
      expect(new Set(glyphs).size).toBe(glyphs.length);
    }
  });

  test("the mark is stable — a role's icon is the catalogue's, not its own set's", () => {
    // A reviewer holds neither /escalations nor /ingest; the doors it does hold
    // draw the same marks they draw for an admin. A mark that changed meaning on
    // a role switch would be worse than a duplicated one.
    const admin = new Map(doorsFor("admin").map((door) => [door.path, doorGlyph(door)]));
    for (const door of doorsFor("reviewer")) {
      expect(doorGlyph(door)).toBe(admin.get(door.path));
    }
  });

  test("a markless door still answers, with its initial — the rail never draws it", () => {
    // `/profile` is group `account`: reachable by chord and printed in the `?`
    // map, drawn in NEITHER rail section. It has no icon and must not need one.
    const profile = doorsFor("admin").find((door) => door.path === "/profile");
    expect(profile && isRailDoor(profile)).toBe(false);
    expect(profile && doorGlyph(profile)).toBe("P");
  });
});

describe("the chord rides the title, and the key stays the only chord source", () => {
  test("the title names the door and the chord that opens it", () => {
    const rulebook = doorsFor("admin").find((door) => door.path === "/rulebook");
    expect(rulebook && doorTitle(rulebook)).toBe("rulebook · g b");
  });

  test("the mark is not the chord — B opens the rulebook, § draws it", () => {
    const rulebook = doorForKey("admin", "b");
    expect(rulebook?.path).toBe("/rulebook");
    expect(rulebook && doorGlyph(rulebook)).toBe("§");
  });
});

/**
 * The gate the rail's Review row bypassed: `startsWith("/orders/")` admitted an
 * order-scoped route without asking the authz table at all.
 */
describe("one gate answers for doors and for order-scoped routes alike", () => {
  test("a role the table refuses /orders is refused the review route", () => {
    expect(canOpen("typist", "/orders")).toBe(false);
    expect(canOpen("typist", "/orders/ord_demo_1/review")).toBe(false);
    expect(canOpen("typist", "/orders/:orderId/review")).toBe(false);
  });

  test("a role the table admits gets it, resolved or still a pattern", () => {
    expect(canOpen("reviewer", "/orders/ord_demo_1/review")).toBe(true);
    expect(canOpen("reviewer", "/orders/:orderId/review")).toBe(true);
  });

  test("an unrestricted path is open by default — the table lists exceptions", () => {
    expect(canOpen("typist", "/questions")).toBe(true);
    expect(canOpen("reviewer", "/ingest")).toBe(false);
  });
});
