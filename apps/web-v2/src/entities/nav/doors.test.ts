import { describe, expect, test } from "vitest";
import { ROLES, type Role } from "@titlepipe/contract";
import { canOpen, doorGlyph, doorTitle, doorForKey, doorsFor, isRailDoor } from "./doors";

/**
 * D2, RE-RULED after adversarial verification. The square shows the LABEL
 * INITIAL wherever that is unambiguous — but the rail's glyphs must also be
 * DISTINCT, because the collapsed 78px rail draws the square and nothing else,
 * so two P squares are two rows a reader cannot tell apart. The version of this
 * file that asserted `["Q","O","E","R","P","C","P","A","S"]` pinned the exact
 * failure `SidebarDoor`'s own doc block says it prevents.
 *
 * The tie-break is `glyphs.ts`: first claim wins on the initial, and a loser
 * draws its own chord key — never an exception list, which would be a second
 * copy of the label free to drift from it.
 */
const railGlyphsFor = (role: Role): string[] =>
  doorsFor(role).filter(isRailDoor).map(doorGlyph);

describe("the rail's glyphs are the label's initials, and they are distinct", () => {
  test("the admin's rail keeps the export's own initials where they are unambiguous", () => {
    const byPath = new Map(doorsFor("admin").map((door) => [door.path, doorGlyph(door)]));
    expect(byPath.get("/queue")).toBe("Q");
    expect(byPath.get("/overview")).toBe("O");
    expect(byPath.get("/escalations")).toBe("E");
    expect(byPath.get("/rulebook")).toBe("R");
    expect(byPath.get("/clients")).toBe("C");
    expect(byPath.get("/audit")).toBe("A");
    expect(byPath.get("/gallery")).toBe("S");
    // Products is first in the catalogue, so it keeps the contested P.
    expect(byPath.get("/products")).toBe("P");
  });

  test("the one collision is broken by the CHORD, not by an exception list", () => {
    // People loses P to Products and draws `g m` — the letter its own title
    // and the `?` map already print, so the square still teaches something true.
    expect(railGlyphsFor("admin")).toEqual(["Q", "O", "E", "R", "P", "C", "M", "A", "S"]);
    const people = doorsFor("admin").find((door) => door.path === "/people");
    expect(people && doorGlyph(people)).toBe("M");
    expect(people && doorTitle(people)).toBe("people · g m");
  });

  test("no two doors the collapsed rail draws share a glyph, for EVERY role", () => {
    for (const role of ROLES) {
      const glyphs = railGlyphsFor(role);
      expect(new Set(glyphs).size).toBe(glyphs.length);
    }
  });

  test("the resolution is stable — a role's glyph is the catalogue's, not its own set's", () => {
    // A reviewer holds neither /escalations nor /ingest; the doors it does hold
    // draw the same letters they draw for an admin. A square that changed
    // meaning on a role switch would be a worse mark than a duplicated one.
    const admin = new Map(doorsFor("admin").map((door) => [door.path, doorGlyph(door)]));
    for (const door of doorsFor("reviewer")) {
      expect(doorGlyph(door)).toBe(admin.get(door.path));
    }
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
