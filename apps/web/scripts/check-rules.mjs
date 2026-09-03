/**
 * Code-quality bar, as a build gate. Only the mechanically checkable rules
 * live here; the judgment ones (prop count, decomposition, naming) are
 * review, not CI. Rules are written to catch the obvious evasions too —
 * `rgb()` instead of hex, `p-[1.5rem]` instead of `p-[24px]`, `Date.parse()`
 * instead of `new Date()` — because a rule that only catches the naive
 * spelling catches nothing.
 *
 * Known remaining holes, stated rather than hidden:
 *   - A cross-feature import laundered through a re-export barrel is not
 *     detected. That needs a real module graph; this is a line scanner.
 *   - `style` spread from a computed object (`{...{ [k]: v }}`) is not detected.
 *   - Deliberate obfuscation ("local" + "Storage") is not the threat model.
 *     This gate is for accidents and habits, not for an adversary.
 *
 * Escape hatch: a line containing `rules-allow:` is skipped, and must be
 * followed by a reason — a bare marker is itself an error.
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

/*
 * Raised from 150 on the owner's call, 2026-09-01. The rule is worth keeping —
 * a 400-line component really is a missing component — but at 150 it was
 * splitting files that had nothing to split: dialog.tsx crossed it by nine
 * lines for a 32px close button, and the "fix" was a second module holding one
 * function. A limit that manufactures indirection is not measuring what it
 * meant to.
 */
const LINE_LIMIT = 250;
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
     * Six type sizes only — 11/13/16/20/28/40. The `--text-*: initial`
     * namespace reset in tokens.css removes named scale members but cannot
     * touch arbitrary-value syntax, and the rule above requires the bracket
     * to open on a digit. These four evasions each emit a seventh
     * font-size and are matched by shape rather than by unit (calc() and a
     * custom property have no unit to match on):
     *
     *     text-[length:13px]     → font-size: 13px
     *     [font-size:13px]       → font-size: 13px
     *     text-[calc(13px)]      → font-size: calc(13px)
     *     text-(length:--x)      → font-size: var(--x)
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
     * Sentence case everywhere, with exactly two exceptions, both
     * identifiable from the class list itself:
     *   - sidebar rubrics            -> drawn in the rail register, `text-rail-*`
     *   - serif certificate headings -> `font-serif`
     * Anything else reaching for `uppercase` is either a label that should
     * be sentence case or a server-supplied identifier recased for
     * decoration — and a recased identifier stops matching the string in
     * the rulebook a reviewer would search for.
     *
     * Known hole: this is a line scanner, so a `className={cx(...)}` split
     * across lines with `uppercase` on one and `font-serif` on another
     * reads as a violation. Every legal use is on one line; if that stops
     * being true, this needs the class list assembled, not a wider regex.
     */
    name: "caps-outside-rubric",
    re: /^(?!.*(?:text-rail-|font-serif)).*\buppercase\b/,
    why: "rule 4 is sentence case — ALL-CAPS only in rail rubrics and serif certificate headings",
  },
  {
    /*
     * The anti-patterns, as a gate. These are gated because they are
     * identifiers and a path literal, so a match is a real read rather than
     * a mention; comment lines are skipped before the ban list runs.
     * Deliberately not gated: the pace vocabulary ("throughput", "per
     * hour", "SLA") — those words appear legitimately in JSX prose that
     * explains what an endpoint may not carry, and a rule that fires on its
     * own refusal being written down is a rule people switch off. That one
     * stays a review question.
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
    /*
     * `as unknown as X` is the standard laundering of `any` and used to pass.
     *
     * `[<,=]\s*any\s*[,>]` is the generic-position arm, and it is the one
     * that matters most: `<any>` alone only caught a SINGLE type argument, so
     * `Record<string, any>`, `Map<K, any>` and a `<T = any>` default — the
     * three commonest spellings of `any` in real code — all walked past a
     * rule the repo states as absolute. Requiring a bracket, comma or equals
     * before and a comma or close after is what keeps the word `any` in
     * prose ("anything queued", "any of these") out of it.
     */
    re: /@ts-ignore|@ts-nocheck|\bas any\b|:\s*any\b|<any>|[<,=]\s*any\s*[,>]|\bas unknown as\b/,
    why: "no `any`, no @ts-ignore, no `as unknown as` laundering (§6)",
  },
];

/** Date handling. Separated because it is whole-file, not line-by-line. */
const DATE_RE =
  /\bnew\s+\(?\s*Date\s*\)?\s*\(|\bDate\s*\.\s*(parse|now|UTC)\s*\(|\bReflect\s*\.\s*construct\s*\(\s*Date\b/;

const BANNED_NAMES = /^(utils?|helpers?|common|misc|shared|stuff)\.(ts|tsx)$/i;

/*
 * There is no vendored-directory exemption: `src/components/ui/` is
 * hand-written code, not registry output, and it is the most reused code in
 * the app — a gate that skips the kit checks the screens for a discipline
 * the kit is free to break. If a registry `add` ever does land here, add an
 * exemption then, scoped to the files it actually wrote.
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
   * Provenance ("never emit a value you can't cite"). `Cited<T>` does not
   * make this a compile error — `<span>{field.value}</span>` typechecks
   * clean, bypassing `readCited`. ESLint's `no-restricted-syntax` companion
   * keys off the name (`field.value`), which misses a Field bound to
   * another identifier; this rule keys off the import. Coarse on purpose,
   * and the two rules overlap deliberately — a single opt-in mechanism is
   * the mechanism that failed. Stories are not exempt: a story that prints
   * `field.value` is the template the next screen is copied from.
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

/*
 * A token declared twice is a token whose value is whichever declaration came
 * last, silently. `--color-surface-evidence` was declared once as the
 * citation highlight and again as a pane background; the second name lost,
 * and two panes painted themselves with the highlight tint. Nothing else in
 * the toolchain sees it — CSS custom properties are legally redeclarable, so
 * this is not a Tailwind error, a tsc error or a lint error.
 */
{
  const tokensPath = new URL(
    "../../../packages/ui-tokens/src/tokens.css",
    import.meta.url,
  ).pathname;
  const text = readFileSync(tokensPath, "utf8");
  const seen = new Map();
  text.split("\n").forEach((line, i) => {
    const m = /^\s*(--[a-z0-9-]+)\s*:/.exec(line);
    // `--foo-*: initial` is a namespace reset, not a value; it is meant to
    // be followed by the declarations it clears.
    if (m === null || line.includes(": initial")) return;
    const first = seen.get(m[1]);
    if (first === undefined) seen.set(m[1], i + 1);
    else
      offenses.push(
        `packages/ui-tokens/src/tokens.css:${i + 1} [duplicate-token] ` +
          `${m[1]} was already declared at line ${first} — the later value ` +
          `silently wins`,
      );
  });
}

if (offenses.length) {
  console.error(`\n${offenses.length} rule violation(s):\n`);
  for (const o of offenses) console.error("  " + o);
  console.error("");
  process.exit(1);
}
console.log(`check-rules: clean (${files.length} files)`);
