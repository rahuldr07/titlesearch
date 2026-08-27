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

/**
 * VENDORED SOURCE IS NOT OUR SOURCE. `src/components/ui/` holds shadcn registry
 * files, added by `pnpm dlx shadcn@latest add` and re-added on upgrade. They
 * are third-party code that happens to live in the tree so it can be read and
 * patched — the same status as `node_modules`, with better ergonomics.
 *
 * They cannot satisfy these rules and should not be edited to: the registry's
 * own idiom is arbitrary values (`w-[var(--radix-select-trigger-width)]`,
 * `[&_svg]:shrink-0`), its files run past 150 lines (`select.tsx` is ~185), and
 * it ships `dark:` variants this app does not use. Hand-editing them to pass
 * would be reverted by the next `add`, and the diff that upgrade produces is
 * the only review that matters for vendored code.
 *
 * The boundary is the point: everything OUTSIDE this directory is ours and is
 * held to every rule. `src/components/ui/` is separate from `src/shared/ui/`
 * for a second reason too — the registry writes `button.tsx` where the kit has
 * `Button.tsx`, and on a case-insensitive filesystem that is one file.
 */
const VENDORED = join(ROOT, "src", "components", "ui");

function walk(dir) {
  if (!existsSync(dir)) return [];
  if (resolve(dir) === VENDORED) return [];
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

  lines.forEach((raw, i) => {
    const n = i + 1;
    const t = raw.trim();

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
