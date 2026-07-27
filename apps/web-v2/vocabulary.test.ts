import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * Forbidden-vocabulary build gate (§0.4). Static complement to the per-screen
 * e2e assertions: it catches source-authored throughput language at build
 * time, in files no e2e visits. Deliberately NARROW — only unambiguous
 * throughput vocabulary is banned. `probe` (dashboard aggregate counts),
 * `rank` (grep-cleaned already), and `leaderboard` (a sanctioned screen) have
 * legitimate uses and are covered by the e2e assertions instead.
 *
 * Escape hatch: a line containing `vocab-allow:` is skipped — use it with a
 * reason, e.g. `// vocab-allow: quoting the prohibition itself`.
 */

const BANNED: { name: string; re: RegExp }[] = [
  { name: "per hour", re: /per[\s-]hour/i },
  { name: "orders/hr", re: /orders\s*\/\s*h(ou)?rs?\b/i },
  { name: "fields/min", re: /fields\s*\/\s*min/i },
  { name: "wpm", re: /\bwpm\b/i },
  { name: "keystrokes-as-metric", re: /keystrokes?\s+(per|count)/i },
  { name: "fastest reviewer", re: /fastest\s+(reviewer|typist)/i },
  { name: "reviewer rank", re: /(reviewer|typist)\s+rank/i },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test("no throughput vocabulary anywhere in src", () => {
  const offenses: string[] = [];
  for (const file of walk(join(process.cwd(), "src"))) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      if (line.includes("vocab-allow:")) return;
      for (const b of BANNED) {
        if (b.re.test(line)) {
          offenses.push(`${file}:${i + 1} [${b.name}] ${t.slice(0, 90)}`);
        }
      }
    });
  }
  expect(offenses).toEqual([]);
});
