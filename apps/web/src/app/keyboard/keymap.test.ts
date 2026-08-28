import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { KEYMAP } from "./keymap";

/**
 * THE JOIN, PROVEN — a key may not be printed unless something installs it.
 *
 * `GlobalKeys` proves its own half by construction: it maps `action` to a
 * handler, and TypeScript refuses a row whose action has none. The review half
 * has no such compiler edge — `features/review/useReviewKeys.ts` is a different
 * layer this file may not import from (§7 cross-feature), and the shortcut
 * overlay would happily print six caps that nothing binds.
 *
 * So the registry is checked against that file's SOURCE. It is the same genre
 * of gate as `vocabulary.test.ts`: static, node-env, and it fails the moment
 * the two lists stop being one list — a key removed from the workstation but
 * left in the overlay, or the reverse.
 */

const REVIEW_HOOKS = join(process.cwd(), "src/features/review/useReviewKeys.ts");

/** `c: (event: KeyboardEvent) => {` — one binding key in a `tinykeys` map. */
const BINDING = /^\s{6}([a-z]):\s*\(event: KeyboardEvent\)/gm;

function boundInReview(): Set<string> {
  const source = readFileSync(REVIEW_HOOKS, "utf8");
  return new Set([...source.matchAll(BINDING)].map((m) => m[1] ?? ""));
}

test("every review-scoped chord is really bound by the workstation", () => {
  const listed = KEYMAP.filter((s) => s.install === "review").map((s) => s.chord);
  expect([...boundInReview()].sort()).toEqual([...listed].sort());
});

test("no review row carries a global action, and no global row lacks one", () => {
  for (const spec of KEYMAP) {
    if (spec.install === "review") expect(spec.action).toBeNull();
    else expect(spec.action).not.toBeNull();
  }
});

test("one row per chord — a second row would install over the first", () => {
  const chords = KEYMAP.map((s) => s.chord);
  expect(new Set(chords).size).toBe(chords.length);
});

test("every row has a section the overlay renders", () => {
  for (const spec of KEYMAP) {
    expect(spec.cap.length).toBeGreaterThan(0);
    expect(spec.desc.length).toBeGreaterThan(0);
  }
});
