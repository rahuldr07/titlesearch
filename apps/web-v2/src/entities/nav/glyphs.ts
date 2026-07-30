import type { Door } from "./doors";

/**
 * ONE SQUARE, ONE DOOR — the letters the rail draws, resolved across the whole
 * door set instead of one door at a time.
 *
 * RULE: no two doors drawn in the same rail may show the same glyph. FAILURE
 * PREVENTED: at 78px the square is the ONLY thing a door row draws (`RailRow`
 * renders no label when collapsed), so two P squares are two rows a reader can
 * separate only by hovering for a `title`. That is the exact failure
 * `SidebarDoor` says it prevents — "a collapsed 78px rail whose rows are
 * indistinguishable from one another".
 *
 * THE EXPORT'S COLLISION WAS NOT COPIED. `sbItem` takes `label.charAt(0)` and
 * lets "Products & sign-off" and "People" both draw P, and its own collapsed
 * rail carries that ambiguity — so this is fidelity against usability, not a
 * bug in one of them. The trade-off taken: keep the export's mark wherever it
 * is unambiguous (it is every door but one, and the initial is the thing the
 * design teaches), and spend a different letter only where a duplicate would
 * otherwise be drawn. Fidelity loses on exactly the row where it costs a reader
 * the ability to tell two doors apart.
 *
 * THE TIE-BREAK, a pure function of the door set: walk the catalogue IN ORDER
 * and give each door the first mark still free from
 *   1. its own INITIAL — first claim wins, so the export's letter survives on
 *      every door but the one that arrives second;
 *   2. its own CHORD KEY, which `doorTitle` and the `?` map already print
 *      beside it, so a fallback square still teaches something true;
 *   3. a later letter of its own label, then any free letter — total, so the
 *      resolution can never fall back silently onto a duplicate.
 *
 * ONE PASS, IN ORDER, is the whole stability guarantee: a door is resolved
 * against the doors BEFORE it and nothing after, so appending a door cannot
 * change a square anybody has already learned. The price is deliberate — a new
 * door whose initial was already spent as an earlier door's fallback draws its
 * chord instead. Moving the settled door would be the worse trade: a mark that
 * changes meaning is worse than a mark that was never the initial.
 *
 * NOT A HAND-MAINTAINED EXCEPTION LIST: an override table would be a second
 * copy of a label's letters, free to drift from the label, which is precisely
 * what deriving the glyph replaced.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Letters only — "products & sign-off" starts P and never `&`, ` ` or `-`. */
function lettersOf(text: string): string[] {
  return [...text.toUpperCase()].filter((char) => char >= "A" && char <= "Z");
}

/** Everything a door would accept, best first; duplicates collapse. */
function candidatesFor(door: Door): string[] {
  const label = lettersOf(door.label);
  // The initial leads even though the label repeats below it — the chord is
  // the SECOND choice, not the first, and `slice(0, 1)` is empty for a label
  // that opens on a digit rather than a letter.
  return [...new Set([...label.slice(0, 1), ...lettersOf(door.key), ...label, ...ALPHABET])];
}

/** Path → glyph, injective over the doors handed in. */
export function railGlyphs(doors: readonly Door[]): ReadonlyMap<string, string> {
  const glyphs = new Map<string, string>();
  const taken = new Set<string>();
  for (const door of doors) {
    const mark = candidatesFor(door).find((letter) => !taken.has(letter));
    if (mark === undefined) {
      // 27 lettered doors cannot be told apart by one letter each. Say so at
      // import time rather than drawing the collision this file exists to stop.
      throw new Error(`nav: no distinct rail glyph left for ${door.path}`);
    }
    taken.add(mark);
    glyphs.set(door.path, mark);
  }
  return glyphs;
}
