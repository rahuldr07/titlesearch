/**
 * The product mark at sign-in size — three stacked rules inside a square, the
 * middle one short.
 *
 * It is a PIPE seen end-on: passes over the same document, one of which came
 * back with less than the others. That is the product in one glyph.
 *
 * CONSTRUCTED THE SAME WAY THE APP CHROME CONSTRUCTS IT — a flex column with a
 * gap, not absolutely positioned bars — so the 40px sign-in mark and the 16px
 * header mark cannot drift apart. Someone who redraws one will find the other
 * expressed identically and change both. Drawn rather than shipped as an image
 * so it inherits the action colour: if the register moves off violet, the mark
 * moves with it instead of becoming the one stale asset on the sign-in screen.
 *
 * `aria-hidden` because the wordmark directly beneath it says TITLEPIPE in text.
 * Announcing the mark too would make a screen-reader user hear the product name
 * twice before reaching the only control on the page.
 */
export function PipeMark() {
  return (
    <span
      aria-hidden
      className="mx-auto mb-9 flex size-20 flex-col justify-center gap-3 rounded-4 border-2 border-action px-2.5"
    >
      <span className="h-1.5 rounded-pill bg-action" />
      <span className="h-1.5 w-3/4 rounded-pill bg-action" />
      <span className="h-1.5 rounded-pill bg-action" />
    </span>
  );
}
