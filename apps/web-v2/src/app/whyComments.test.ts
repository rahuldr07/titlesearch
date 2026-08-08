import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vitest";

/**
 * A COMMENT STATING AN UNTESTED GUARANTEE IS WHAT THE NEXT READER BUILDS ON.
 *
 * The fidelity audit found three in one pass, all of the same shape: a claim
 * true of an earlier arrangement, left in place after the arrangement changed.
 * `AppChrome`'s header described a component nesting that had moved twice;
 * `OrderCounts` claimed "always visible, never breakpoint-hidden" and, in the
 * same docstring, "DERIVED FROM SERVER STATE ONLY" while walking the field
 * array to rule on provenance in the browser; `StageRow` claimed the design
 * sets all three stage owners identically, which is true of the export's render
 * and false of its markup.
 *
 * Prose cannot police prose, so each corrected claim is stated as a property of
 * the FILE and checked here. This lives in `src/app/` rather than `src/shared/`
 * because it is a gate, not a shared component, and the chrome is where the
 * three claims were found.
 */

/** Phrases the audit retired. Any reappearance is the old claim coming back. */
const BANNED_ANYWHERE: readonly string[] = [
  "Always visible, never breakpoint-hidden",
  "it is spliced in below rather than appended after",
  "The design sets all three owners in",
  "DERIVED FROM SERVER STATE ONLY",
];

/** Each correction, pinned to the file the false claim was found in. */
const REQUIRED: readonly { file: string; phrase: string }[] = [
  {
    file: "src/app/chrome/AppChrome.tsx",
    phrase: "IT RENDERS THE RAIL AND NOTHING ELSE",
  },
  {
    file: "src/app/chrome/AppChrome.tsx",
    phrase: "QUERIES BELOW ARE GATED ON THE ONE `fetches` FLAG",
  },
  { file: "src/app/chrome/OrderCounts.tsx", phrase: "NO BREAKPOINT HIDES THESE" },
  {
    file: "src/app/chrome/OrderCounts.tsx",
    phrase: "EVERY FIGURE IS READ FROM `census`, NEVER COMPUTED HERE",
  },
  {
    file: "src/features/processing/StageRow.tsx",
    phrase: "WHERE THE MARKUP AND THE RENDER DISAGREE, THE RENDER GOVERNS",
  },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const SRC = join(process.cwd(), "src");
/**
 * Block-comment continuation markers go first, then whitespace collapses — so a
 * claim re-wrapped across three lines still reads as one sentence and cannot be
 * smuggled past by reflowing it.
 */
const flatten = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\n\s*\*\s?/g, " ")
    .replace(/\s+/g, " ");
const sources = walk(SRC).filter((path) => !path.endsWith("whyComments.test.ts"));

test("no comment in src asserts a guarantee the code does not hold", () => {
  const offenses: string[] = [];
  for (const path of sources) {
    const flat = flatten(path);
    for (const phrase of BANNED_ANYWHERE) {
      if (flat.includes(phrase))
        offenses.push(`${relative(SRC, path)} ASSERTS: ${phrase}`);
    }
  }
  expect(offenses).toEqual([]);
});

test("each corrected claim is stated where the audit found the false one", () => {
  const offenses: string[] = [];
  for (const { file, phrase } of REQUIRED) {
    if (!flatten(join(process.cwd(), file)).includes(phrase)) {
      offenses.push(`${file} LOST: ${phrase}`);
    }
  }
  expect(offenses).toEqual([]);
});

/**
 * The narrow, TRUE half of the retired counts claim — a fact about the file,
 * not a rule. The export hides the tiles below 1180px and the design spec ruled
 * to adopt that; this app does not yet (open item G1 in `conflicts.md`). The
 * assertion exists so the gap stays visible: close it and this test fails,
 * which is the prompt to strike G1 rather than leave two records disagreeing.
 */
test("the order counts carry no responsive-visibility utility", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/chrome/OrderCounts.tsx"),
    "utf8",
  );
  const markup = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  expect(markup).not.toMatch(
    /\b(sm|md|lg|xl|2xl|max-[a-z]+):(hidden|flex|block|inline-flex)\b/,
  );
});

/**
 * The other half: the four figures are the server's census, read whole. The
 * defect this replaces filtered `fields` for `source_doc_id === null &&
 * source_page === null && readings.length === 0` and printed the result as a
 * headline — the browser ruling on provenance, which is a server judgement
 * (hard rule 3) and one no screen can cite (principle 6).
 */
test("the order counts compute no figure of their own", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/chrome/OrderCounts.tsx"),
    "utf8",
  );
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const forbidden of [".filter(", ".length", ".reduce(", "=== null", "!== null"]) {
    expect(code, `OrderCounts must not ${forbidden}`).not.toContain(forbidden);
  }
});

/**
 * Citations are load-bearing: a comment naming a spec that does not exist reads
 * exactly like one naming a spec that does. Two are cited across the chrome and
 * neither was ever migrated — `blind-blindness.spec` (harvested, `net.ts` is the
 * in-page wrapper it needs and nothing calls it) and `roles.spec` (harvested,
 * folded into `authz.test.ts`). A file may still name them, but only while
 * saying they are NOT BUILT and naming what holds instead.
 *
 * SCOPED TO `src/app/` deliberately. The same defect exists in fourteen further
 * places outside the chrome — `leaderboard.spec`, `account.spec`, `home.spec`,
 * `delivery-complaints.spec`, `golden.spec` — and widening this gate would fail
 * on files this pass does not own. Widen it when those are corrected.
 */
test("a spec the chrome cites as proof is either built or named as unbuilt", () => {
  const built = new Set(
    readdirSync(join(process.cwd(), "e2e/invariants"))
      .filter((name) => name.endsWith(".spec.ts"))
      .map((name) => name.replace(/\.ts$/, "")),
  );
  const offenses: string[] = [];
  for (const path of sources.filter((candidate) =>
    candidate.startsWith(join(SRC, "app")),
  )) {
    const flat = flatten(path);
    for (const [, cited] of flat.matchAll(/`([a-z-]+\.spec)`/g)) {
      if (cited === undefined || built.has(cited) || flat.includes("NOT BUILT"))
        continue;
      offenses.push(`${relative(SRC, path)} CITES UNBUILT: ${cited}`);
    }
  }
  expect(offenses).toEqual([]);
});
