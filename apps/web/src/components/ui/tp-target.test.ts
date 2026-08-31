import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

/**
 * @utility output is emitted after the numeric utilities, so an unguarded
 * tp-target silently clobbers any min-h-* on the same element at equal
 * specificity. Asserted on the source because the failure is a cascade fact;
 * if the guard clause is ever removed, the clobber comes back for every
 * future component.
 */
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
