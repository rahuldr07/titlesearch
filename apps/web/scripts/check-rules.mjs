/**
 * BRIEF §6 code-quality bar, as a build gate.
 *
 * Only the mechanically checkable rules live here. The judgment ones — prop
 * count, decomposition, naming, prop-drilling depth — are review, not CI, and
 * are deliberately absent rather than approximated badly.
 *
 * HARDENED 2026-07-27 after an audit defeated 9 of 11 rules with the FIRST
 * evasion a tired developer would reach for — not clever ones, the obvious
 * ones: `rgb()` instead of hex, `p-[1.5rem]` instead of `p-[24px]`,
 * `Date.parse()` instead of `new Date()`. A rule that only catches the naive
 * spelling is a rule that catches nothing, because nobody writes the naive
 * spelling twice.
 *
 * Known remaining holes, stated rather than hidden:
 *   - A cross-feature import laundered through a re-export barrel is not
 *     detected. That needs a real module graph; this is a line scanner.
 *   - `style` spread from a computed object (`{...{ [k]: v }}`) is not detected.
 *   - Deliberate obfuscation ("local" + "Storage") is not the threat model.
 *     This gate is for accidents and habits, not for an adversary.
 *
 * Escape hatch: a line containing `rules-allow:` is skipped, and MUST be
 * followed by a reason — a bare marker is now itself an error.
 *
 *   node scripts/check-rules.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, sep, dirname, resolve } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
/** Scanned for the rules that apply outside the component tree too. */
const EXTRA_ROOTS = [join(ROOT, ".storybook")];

/** The single audited date utility — the one place date handling may live. */
const DATE_UTILITY = join("src", "shared", "date.ts");

/**
 * The single file allowed to read a contract `Field`'s `.value` — that is what
 * `readCited` exists to do. Everything else goes through the `FieldValue`
 * union it returns.
 */
const PROVENANCE_MODULE = join("src", "shared", "provenance.ts");

/** A file that pulls `Field` out of the frozen contract. */
const IMPORTS_FIELD =
  /import\s+(?:type\s+)?\{[^}]*\bField\b[^}]*\}\s+from\s+["']@titlepipe\/contract["']/;

/** `.value` read as a member, computed or not. `x["value"]` included. */
const FIELD_VALUE_ACCESS = /\.\s*value\b|\[\s*["']value["']\s*\]/;

const LINE_LIMIT = 150;
/** A 2-line 1,900-character file passed the line count. Bytes catch that. */
const CHAR_LIMIT = 8000;

const BANNED = [
  {
    name: "hardcoded-colour",
    // Hex, and every CSS colour function. `rgb(74 47 174)` used to sail past.
    re: /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\s*\(/,
    why: "colour must come from packages/ui-tokens (§6)",
  },
  {
    name: "arbitrary-value",
    // Any arbitrary Tailwind value carrying a length unit — not just px.
    // `p-[1.5rem]`, `gap-[2em]`, `w-[42ch]`, `text-[13pt]` all used to pass.
    // Absolute lengths only. vw/vh/%/vmin express a relationship to the
    // viewport or parent, which no design token can encode — banning those
    // produces noise, not safety.
    re: /\[[-0-9.]+(px|rem|em|ch|ex|pt|pc|in|cm|mm)\]/i,
    why: "spacing/radii/size must come from tokens, not arbitrary values (§6)",
  },
  {
    /*
     * RULE 2, THE OTHER FOUR DOORS. Six type sizes only — 11/13/16/20/28/40.
     *
     * `tokens.css`'s `--text-*: initial` reset genuinely works: built against
     * real Tailwind 4.3.3, `text-sm` and `text-2xl` emit NOTHING. But a
     * namespace reset only removes NAMED scale members. It cannot touch
     * arbitrary-value syntax, and the rule above cannot either — it requires
     * the bracket to open on a digit.
     *
     * REVIEW-02 built all six evasions and ran them through the compiler. Two
     * were caught. These four were not, and each emits a seventh font-size:
     *
     *     text-[length:13px]     → font-size: 13px
     *     [font-size:13px]       → font-size: 13px
     *     text-[calc(13px)]      → font-size: calc(13px)
     *     text-(length:--x)      → font-size: var(--x)
     *
     * Matched here by SHAPE rather than by unit, because `calc()` and a custom
     * property have no unit to match on.
     */
    name: "seventh-type-size",
    re: /\btext-\[(length:|calc\()|\[font-size:|\btext-\(length:/i,
    why: "rule 2 allows six type sizes — use --text-label/meta/body/subject/title/verdict",
  },
  {
    name: "inline-style",
    re: /\bstyle=\{|\bstyle="|\bstyle:\s*\{/,
    why: "no inline styles (§6)",
  },
  {
    name: "important",
    // Literal !important AND Tailwind's own `!` modifier in either position —
    // `!w-full` / `text-ink!`. The modifier is the only way anyone writes
    // important in this codebase, and the old rule missed it entirely.
    re: /!important/,
    // The `!` modifier is tested against STRING LITERALS ONLY. Scanning the
    // raw line matched `if (!year || !month)` in date.ts — a boolean negation
    // read as a class name. A rule with false positives gets switched off.
    inStrings: /(?:^|\s)(?:![a-z][a-z0-9-]*|[a-z][a-z0-9-]*!)(?=\s|$)/,
    why: "no !important, including Tailwind's `!` modifier (§6)",
    /*
     * THE ONE PLACE `!important` IS CORRECT, and it is narrow on purpose.
     *
     * `@media (prefers-reduced-motion: reduce)` has to beat every animation
     * any component can declare, INCLUDING ones written after it. Specificity
     * cannot express "beat everything", so `!important` is the only mechanism
     * CSS offers, and WCAG §2.3.3 plus design rule 10 ("nothing bounces")
     * make it a requirement rather than a shortcut.
     *
     * The exemption is keyed to being INSIDE that at-rule, not to the file, so
     * it cannot spread: an `!important` anywhere else in styles.css is still
     * an error. `rules-allow:` was the alternative and is worse here — it
     * would need four markers on four lines that are one rule.
     */
    exemptInAtRule: /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/,
  },
  {
    /*
     * RULE 4, AND THE COMMENT THAT CLAIMED THIS GATE ALREADY EXISTED.
     *
     * `sidebar-menu.tsx:54` read: "check-rules.mjs bans `uppercase` outside
     * rail/sidebar/certificate, so this is the one place it is legal." It did
     * not. There was no rule 4 check of any kind, and eighteen elements across
     * nine screens were ALL-CAPS on the strength of a sentence asserting a
     * mechanism that was never written — the same failure REVIEW-03 names as
     * the theme of this kit, one layer down.
     *
     * Rule 4 has exactly two exceptions and both are identifiable from the
     * class list itself, which is why this can be mechanical rather than a
     * judgement call:
     *
     *   - sidebar rubrics            -> drawn in the rail register, `text-rail-*`
     *   - serif certificate headings -> `font-serif`
     *
     * Anything else reaching for `uppercase` is either a label that should be
     * sentence case, or — worse, and this is what the rule actually caught — a
     * SERVER-SUPPLIED IDENTIFIER recased for decoration. Four components
     * rendered `judgments.hit_identity` as `JUDGMENTS.HIT_IDENTITY`. That is
     * not a style choice: the string a reviewer sees stops matching the string
     * in the rulebook they would search for.
     *
     * KNOWN HOLE, stated rather than hidden: this is a line scanner, so a
     * `className={cx(...)}` split across lines with `uppercase` on one and
     * `font-serif` on another reads as a violation. Every legal use in the tree
     * is on one line and should stay that way; if that stops being true, this
     * needs the class list assembled, not a wider regex.
     */
    name: "caps-outside-rubric",
    re: /^(?!.*(?:text-rail-|font-serif)).*\buppercase\b/,
    why: "rule 4 is sentence case — ALL-CAPS only in rail rubrics and serif certificate headings",
  },
  {
    /*
     * THE ANTI-PATTERNS, AS A GATE. AGENTS.md lists six things whose
     * reintroduction is "a defect, not a feature request", and until now
     * nothing checked for any of them — they were prose in a rulebook, which
     * is exactly the shape of enforcement REVIEW-03 warns about.
     *
     * These three are gated because they are IDENTIFIERS and a path literal,
     * so a match is a real read rather than a mention. Note that comment lines
     * are skipped before the ban list runs, which is why the many doc comments
     * saying "`/api/metrics` is deliberately NOT read here" do not trip it.
     *
     * DELIBERATELY NOT GATED: the pace VOCABULARY ("throughput", "elapsed",
     * "per hour", "SLA"). Those words appear legitimately in JSX prose that
     * explains what a future endpoint may not carry — `blindStatus/RosterGaps`
     * asks for coverage and says INVARIANT 23 "refuses rates, elapsed time,
     * estimates" — and a rule that fires on its own refusal being written down
     * is a rule people switch off. That one stays a review question.
     */
    name: "probe-visibility",
    re: /\bprobes_planted\b|\bprobes_caught\b|\bcatch_rate\b/,
    why: "no probe visibility (AGENTS.md anti-patterns) — /api/metrics carries these and no screen may draw them",
  },
  {
    name: "pace-endpoint",
    // The path as a STRING, which is the only way a screen reaches it.
    re: /["'`]\/api\/metrics/,
    why: "/api/metrics carries median_minutes_per_order, a pace indicator (INVARIANTS 23) — it is the dashboard's alone",
  },
  {
    name: "approve-all",
    re: /\bapproveAll\b|\bconfirmAll\b|\bbulkConfirm\b|\bapprove-all\b/i,
    why: "no approve-all (AGENTS.md anti-patterns) — one act files one record",
  },
  {
    name: "browser-storage",
    re: /\b(localStorage|sessionStorage)\b|\[\s*["'](local|session)Storage["']\s*\]/,
    why: "nothing in localStorage or sessionStorage (§9.11) — preferences live on the server (§7)",
  },
  {
    name: "ts-escape-hatch",
    // `as unknown as X` is the standard laundering of `any` and used to pass.
    re: /@ts-ignore|@ts-nocheck|\bas any\b|:\s*any\b|<any>|\bas unknown as\b/,
    why: "no `any`, no @ts-ignore, no `as unknown as` laundering (§6)",
  },
];

/** Date handling. Separated because it is whole-file, not line-by-line. */
const DATE_RE =
  /\bnew\s+\(?\s*Date\s*\)?\s*\(|\bDate\s*\.\s*(parse|now|UTC)\s*\(|\bReflect\s*\.\s*construct\s*\(\s*Date\b/;

const BANNED_NAMES = /^(utils?|helpers?|common|misc|shared|stuff)\.(ts|tsx)$/i;

/*
 * THERE IS NO VENDORED DIRECTORY, AND THE EXEMPTION THAT CLAIMED OTHERWISE IS
 * GONE.
 *
 * This file used to skip `src/components/ui/` entirely, on the grounds that it
 * held shadcn registry output — third-party code with "the same status as
 * node_modules". That premise was false. `shadcn init --base aria` was never
 * run (`components.json` has no `base` key, and points `tailwind.css` and the
 * `utils` alias at two paths that do not exist), and every file in that
 * directory is hand-written against `react-aria-components`, this repo's own
 * `cva`/`cx`/`disabled.ts`, and the fourteen design rules.
 *
 * So the exemption was excusing 49 files and ~2,965 lines of THE MOST REUSED
 * CODE IN THE APP from the raw-hex, arbitrary-value and file-length gates,
 * while reporting green. A gate that skips the kit is a gate that checks the
 * screens for a discipline the kit is free to break.
 *
 * If a registry `add` ever does land here, re-add an exemption THEN, scoped to
 * the files it actually wrote, and say so in the commit. Do not restore this
 * one on the strength of a `components.json` that describes a setup nobody
 * performed.
 */

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(p);
  }
  return out;
}

/** `src/features/<name>/…` → `<name>`, else null. */
function featureOf(relPath) {
  const parts = relPath.split(sep);
  return parts[0] === "src" && parts[1] === "features" ? (parts[2] ?? null) : null;
}

const offenses = [];
const add = (file, line, rule, detail) =>
  offenses.push(`${relative(ROOT, file)}:${line} [${rule}] ${detail}`);

const files = [...walk(SRC), ...EXTRA_ROOTS.flatMap(walk)];

for (const file of files) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  /*
   * PROVENANCE (AGENTS.md: "Never emit a value you can't cite").
   *
   * REVIEW-01 B1 proved that `Cited<T>` does not make this a compile error:
   * `<span>{field.value}</span>` typechecks clean, bypassing `readCited`
   * entirely, and that is the exact rule "caught 6 times in prototyping".
   *
   * ESLint's `no-restricted-syntax` companion to this keys off the NAME
   * (`field.value`), which misses a Field bound to another identifier. This
   * rule carries the other half: it keys off the IMPORT. If a file pulls
   * `Field` out of the frozen contract, it is in the business of handling
   * server field records, and it may not touch `.value` at all — it goes
   * through `readCited`. Coarse on purpose. The two rules overlap
   * deliberately, because the review's finding was that a single opt-in
   * mechanism is the mechanism that failed six times.
   *
   * Stories are NOT exempt: a story that prints `field.value` is the template
   * the next screen is copied from.
   */
  if (rel !== PROVENANCE_MODULE && IMPORTS_FIELD.test(text)) {
    lines.forEach((raw, i) => {
      const t = raw.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      if (raw.includes("rules-allow:")) return;
      // A property being WRITTEN in an object literal (`value: "X"`) is a
      // fixture constructing a Field, not a render reading one.
      if (!FIELD_VALUE_ACCESS.test(raw)) return;
      add(
        file,
        i + 1,
        "raw-field-value",
        "this file imports `Field` from the contract and reads `.value` — go through `readCited` (shared/provenance.ts) and render the FieldValue union. Never emit a value you can't cite (AGENTS.md; REVIEW-01 B1)",
      );
    });
  }

  if (BANNED_NAMES.test(basename(file)) || /[\\/]utils?[\\/]index\.tsx?$/i.test(rel)) {
    add(
      file,
      1,
      "junk-drawer",
      "no utils/helpers/common/misc module (§6) — name it for what it does",
    );
  }

  // §6's limit exists because "a component is missing". A test file
  // enumerating cases is not a component and splitting it to satisfy a count
  // would make it worse, so tests are exempt from the LINE limit only — every
  // other rule still applies to them.
  const isTest = /\.test\.tsx?$/.test(rel);
  if (!isTest && lines.length > LINE_LIMIT) {
    add(
      file,
      lines.length,
      "file-too-long",
      `${lines.length} lines > ${LINE_LIMIT} (§6) — a component is missing`,
    );
  } else if (!isTest && text.length > CHAR_LIMIT) {
    add(
      file,
      lines.length,
      "file-too-long",
      `${text.length} chars > ${CHAR_LIMIT} on ${lines.length} lines (§6) — long lines are not a workaround`,
    );
  }

  // Whole-file so a line-wrapped `new\n  Date(` cannot hide. Comments are
  // stripped first: date.test.ts documents the bug it prevents by quoting
  // `new Date("2024-03-15")` in prose, which is not a use.
  if (rel !== DATE_UTILITY && DATE_RE.test(stripComments(stripAllowed(text)))) {
    const n = lines.findIndex(
      (l) => DATE_RE.test(l) && !l.includes("rules-allow:") && !/^\s*[/*]/.test(l),
    );
    if (n >= 0) {
      add(
        file,
        n + 1,
        "raw-date",
        `date construction outside ${DATE_UTILITY} (§8) — Date.parse and Date.now carry the same UTC bug as new Date()`,
      );
    }
  }

  const feature = featureOf(rel);
  const isPresentational =
    rel.startsWith(join("src", "shared")) || rel.startsWith(join("src", "entities"));

  /** The at-rule enclosing the current line, and its brace depth. Per file. */
  let openAtRule = null;
  let atRuleDepth = 0;

  lines.forEach((raw, i) => {
    const n = i + 1;
    const t = raw.trim();

    /*
     * Which at-rule, if any, encloses this line. Brace-counted rather than
     * parsed: this is a line scanner, and an at-rule block is the one CSS
     * structure a banned-pattern exemption needs to be scoped to.
     */
    if (openAtRule === null && t.startsWith("@") && raw.includes("{")) {
      openAtRule = t;
      atRuleDepth = 1;
    } else if (openAtRule !== null) {
      atRuleDepth += (raw.match(/\{/g) ?? []).length;
      atRuleDepth -= (raw.match(/\}/g) ?? []).length;
      if (atRuleDepth <= 0) openAtRule = null;
    }

    // A line inside a block comment is prose, never code — including prose that
    // explains the escape hatch itself.
    const inBlockComment = t.startsWith("*") || t.startsWith("/*");
    if (raw.includes("rules-allow:")) {
      if (inBlockComment) return;
      // The hatch now needs a reason. A bare marker used to silence any rule.
      const reason = raw.split("rules-allow:")[1]?.trim() ?? "";
      if (reason.replace(/[*/\s]+$/, "").length < 12) {
        add(
          file,
          n,
          "unjustified-exemption",
          "`rules-allow:` must be followed by a reason of at least 12 characters (§6)",
        );
      }
      return;
    }
    if (t.startsWith("//") || inBlockComment) return;

    for (const b of BANNED) {
      // Scoped exemption: correct INSIDE one at-rule, an error everywhere else.
      if (b.exemptInAtRule && openAtRule !== null && b.exemptInAtRule.test(openAtRule)) {
        continue;
      }
      if (b.re.test(raw)) {
        add(file, n, b.name, b.why);
      } else if (b.inStrings && stringLiterals(raw).some((s) => b.inStrings.test(s))) {
        add(file, n, b.name, b.why);
      }
    }

    // Static and dynamic specifiers both.
    const imp = raw.match(/from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/);
    if (!imp) return;
    const spec = imp[1] ?? imp[2];
    if (!spec) return;

    if (feature) {
      let other = null;
      if (spec.startsWith(".")) {
        other = featureOf(relative(ROOT, resolve(dirname(file), spec)));
      } else {
        const m = spec.match(/(?:^|\/)features\/([^/"']+)/);
        other = m ? m[1] : null;
      }
      if (other && other !== feature) {
        add(
          file,
          n,
          "cross-feature-import",
          `features/${feature} imports features/${other} (§7) — go through entities/ or shared/`,
        );
      }
    }

    if (isPresentational && /^@tanstack\/(react-query|react-router)/.test(spec)) {
      add(
        file,
        n,
        "presentational-fetches",
        `${rel.split(sep)[1]}/ must not import ${spec} (§6) — features fetch, components render`,
      );
    }
  });
}

/** Remove `rules-allow:` lines before whole-file checks. */
function stripAllowed(text) {
  return text
    .split("\n")
    .filter((l) => !l.includes("rules-allow:"))
    .join("\n");
}

/** Remove block and line comments — prose that quotes banned code is not a use. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** The quoted string literals on a line, without their quotes. */
function stringLiterals(line) {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? "",
  );
}

if (offenses.length) {
  console.error(`\n${offenses.length} rule violation(s):\n`);
  for (const o of offenses) console.error("  " + o);
  console.error("");
  process.exit(1);
}
console.log(`check-rules: clean (${files.length} files)`);
