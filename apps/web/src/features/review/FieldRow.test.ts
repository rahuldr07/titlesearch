import { expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `tp-field-row-grid` shipped as a DEAD CLASS: used once in FieldRow, declared
 * in no stylesheet, absent from the built CSS, so the four-track row silently
 * rendered single-column (REVIEW-04 §5). Nothing caught it — tsc, eslint,
 * check-rules and Storybook all see a class name and none sees whether a rule
 * was ever emitted. These two tests are that missing layer.
 */
const SRC = new URL("../..", import.meta.url).pathname;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(SRC);
const css = [
  ...files.filter((p) => p.endsWith(".css")),
  // Tokens declare `--animate-tp-pulse`, which Tailwind turns into a real
  // utility without any `@utility` block. Read so it is not a false positive.
  new URL("../../../../../packages/ui-tokens/src/tokens.css", import.meta.url).pathname,
]
  .map((p) => readFileSync(p, "utf8"))
  .join("\n");

/** A `tp-` name is declared if any stylesheet emits it, by either mechanism. */
function declared(name: string): boolean {
  return css.includes(`@utility ${name}`) || css.includes(`--animate-${name}:`);
}

test("the field row declares the design's four tracks", () => {
  const row = readFileSync(join(SRC, "features/review/FieldRow.tsx"), "utf8");
  // 140px label / 1fr value / 70px cite / 24px mark — REVIEW-04 §5.
  expect(row).toContain("grid-cols-[140px_minmax(0,1fr)_70px_24px]");
});

test("every tp- class used in the tree is declared as an @utility", () => {
  const used = new Set<string>();
  for (const p of files) {
    if (!/\.tsx?$/.test(p) || /\.test\.tsx?$/.test(p)) continue;
    // Only string literals — a `tp-` name inside a comment is prose about the
    // class, not a use of it, and the comments here discuss dead classes.
    const source = readFileSync(p, "utf8");
    for (const lit of source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
      for (const m of (lit[1] ?? lit[2] ?? lit[3] ?? "").matchAll(/\btp-[a-z0-9-]+/g)) {
        // `tp-zoom-cx` / `tp-zoom-cy` are custom properties, not utilities.
        if (!/^tp-zoom-c[xy]$/.test(m[0])) used.add(m[0]);
      }
    }
  }
  const undeclared = [...used].filter((name) => !declared(name));
  expect(undeclared).toEqual([]);
});
