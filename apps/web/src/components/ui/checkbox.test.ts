import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

/**
 * THE LABEL IS A ROW, NOT A BOX.
 *
 * `react-aria`'s `Checkbox` renders as a `<label>` wrapping BOTH the drawn
 * square and its text. Box styling put on that element therefore lands on the
 * whole row, and it did: `size-8` clamped the label to 16px wide and
 * `font-mono text-label` set the words in 11px mono, which rule 3 reserves for
 * data. The label wrapped one letter per line inside the square.
 *
 * A screenshot caught it; nothing else could have. `tsc` was clean, the gate
 * was clean, every story "rendered". So this asserts the SHAPE of the fix
 * rather than its pixels: the drawn square lives on the indicator span, and
 * the label owns typography.
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
