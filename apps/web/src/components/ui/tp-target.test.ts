import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

/**
 * REVIEW-03 B3. `tp-target` set a raw `min-block-size`, and `@utility` output
 * is emitted AFTER the numeric utilities — so at equal specificity it won every
 * race against a `min-h-*` on the same element. `Textarea` asked for a 72px
 * three-line floor and got 24px, masked by `field-sizing-content` growing the
 * box to one line so it looked plausible.
 *
 * Asserted on the SOURCE rather than the render because the failure is a
 * cascade fact, and the rendered proof lives in the browser check that produced
 * `minHeight: 72px`. This is the regression guard: if the guard clause is ever
 * removed, the silent clobber comes back for every future component.
 */
// `tp-target` and `tp-ring` moved to a11y.css when ui.css crossed the 150-line
// gate — they are conformance utilities, not the design's motion language.
const css = readFileSync(new URL("./a11y.css", import.meta.url), "utf8");
const target = css.slice(css.indexOf("@utility tp-target"), css.indexOf("@utility tp-ring"));

test("tp-target yields to a component that declared its own height floor", () => {
  expect(target).toMatch(/&:not\(\[class\*="min-h-"\]\)/);
  expect(target).toMatch(/&:not\(\[class\*="min-w-"\]\)/);
});

test("it still sets the WCAG 2.5.8 minimum when nothing else does", () => {
  expect(target).toMatch(/min-block-size:\s*var\(--size-control-md\)/);
  expect(target).toMatch(/min-inline-size:\s*var\(--size-control-md\)/);
});

test("Textarea still declares the floor the comment claims", () => {
  const ta = readFileSync(new URL("./textarea.tsx", import.meta.url), "utf8");
  // --spacing is 2px, so min-h-36 is 72px: three lines of 13px.
  expect(ta).toMatch(/\bmin-h-36\b/);
});
