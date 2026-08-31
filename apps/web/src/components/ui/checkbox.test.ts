import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

/**
 * react-aria's Checkbox renders as a <label> wrapping both the drawn square
 * and its text, so box styling on that element lands on the whole row. These
 * assert the shape of the fix rather than its pixels: the drawn square lives
 * on the indicator span, and the label owns typography.
 */
const source = readFileSync(new URL("./checkbox.tsx", import.meta.url), "utf8");

const labelClasses = source.slice(
  source.indexOf("className={cx("),
  source.indexOf("checkbox-indicator"),
);

test("the label carries no box geometry", () => {
  expect(labelClasses).not.toMatch(/\bsize-\d/);
  expect(labelClasses).not.toMatch(/\bborder-control-border\b/);
});

test("the label is sans and on the meta rung, never mono", () => {
  expect(labelClasses).toMatch(/\bfont-sans\b/);
  expect(labelClasses).not.toMatch(/\bfont-mono\b/);
});

test("the indicator carries the square, the mark font, and the WCAG hit area", () => {
  const indicator = source.slice(source.indexOf("checkbox-indicator"));
  expect(indicator).toMatch(/\bsize-8\b/);
  expect(indicator).toMatch(/\bfont-mono\b/);
  // §2.5.8: the square is 16px; the pseudo-element grows the target to 24.
  expect(indicator).toMatch(/after:-inset/);
});
