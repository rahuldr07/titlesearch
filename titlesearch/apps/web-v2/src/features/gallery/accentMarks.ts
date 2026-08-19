import type { GalleryAccent } from "./galleryStates";

/**
 * THE MARK THAT SURVIVES A PHOTOCOPIER — one glyph per severity register.
 *
 * WHY THIS EXISTS. `tokens.css` measures its own palette honestly and states
 * the consequence in its header: settled and attend sit 1.16:1 apart in
 * greyscale, which is nothing, and it says those two "are separated by hue and
 * by CHIP FORM". The hue half shipped. The chip-form half did not, so three of
 * the gallery's four registers — `Closed · added` (settled), `Closed · amended`
 * (action) and `Note only` (attend) — drew as the same rectangle the moment
 * colour was removed.
 *
 * That matters most HERE, of all places. The gallery is the surface every other
 * screen is audited against; a distinction that fails on the catalogue fails
 * everywhere and nobody finds out, because the catalogue is where you would
 * have looked.
 *
 * WHY A GLYPH AND NOT A SHAPE. `StateSample`'s doc block argues deliberately for
 * ONE SHAPE, FOUR TONES — a reader should recognise the block instantly and read
 * only its signal, not compare four layouts — and that argument is right. A
 * glyph inside the badge adds a colour-independent channel without asking anyone
 * to learn a second composition. It is also the grammar this codebase already
 * uses for exactly this problem: `entities/field/NoValue.tsx` separates the
 * no-value states by leading glyph and fill pattern, never by hue alone.
 *
 * WHY NOT BORDER WEIGHT. Stroke width is a SEMANTIC AXIS here
 * (`--stroke-structure` … `--stroke-severity`), and `tokens.css` says accent and
 * severity must not converge. Spending it on a second meaning would collide two
 * vocabularies to fix one.
 *
 * THE GLYPH IS DECORATION, NOT THE ONLY CHANNEL. Every badge already names its
 * state in words, so assistive tech is served by the text and the glyph is
 * `aria-hidden`. Three channels carry the distinction — words for a screen
 * reader, shape for greyscale and print, hue for everyone else — and no single
 * one of them is load-bearing alone. That is the property `accentMarks.test.ts`
 * gates.
 *
 * JSX-free on purpose, exactly as `entities/field/noValueStates.ts` is: it makes
 * the totality testable in the node Vitest project with no DOM.
 */

/**
 * Every register, as a value rather than only a type — the test iterates it, so
 * a fifth register cannot be added without the pairwise-distinctness check
 * seeing it.
 */
export const GALLERY_ACCENTS = ["settled", "halt", "action", "attend"] as const;

/**
 * Four silhouettes chosen to differ in OUTLINE, not merely in identity: a tick,
 * a cross, an arrow and a bar-and-dot share no strokes, so they stay separable
 * at the 9.5px the badge is set in and after a fax machine has had them.
 *
 * Each also says what its register means, rather than being an arbitrary token:
 *   settled  done, nothing owed
 *   halt     stopped
 *   action   a person must move this forward — the same arrow the decision bar
 *            spends on "can't decide — escalate"
 *   attend   look at this
 */
export function accentMark(accent: GalleryAccent): string {
  switch (accent) {
    case "settled":
      return "✓";
    case "halt":
      return "✕";
    case "action":
      return "↗";
    case "attend":
      return "!";
    default: {
      // Unreachable while the union is total. Throwing rather than returning ""
      // is deliberate: an empty mark is exactly the greyscale collapse this
      // module exists to prevent, and it would ship silently.
      const unreachable: never = accent;
      throw new Error(`Unhandled gallery accent: ${JSON.stringify(unreachable)}`);
    }
  }
}
