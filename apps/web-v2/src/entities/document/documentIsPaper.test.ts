import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * THE DOCUMENT DOES NOT INVERT — as a build gate, not a comment.
 *
 * `packages/ui-tokens/src/tokens.css` declares the page family twice, marked
 * PINNED, under the rule "a scan is a photograph of paper: the surround
 * darkens, the page stays light". The pin was documentation of an intent
 * nobody wired: the facsimile painted itself `bg-surface-panel` /
 * `text-ink-primary`, which are UI-CHROME tokens, so under
 * `[data-theme="mocha"]` a scanned county record rendered as a dark slab with
 * light type. 497 unit tests and 86 e2e did not see it, because no test read
 * which token family the page reaches for.
 *
 * This reads the shipped sources and the shipped token file and proves the
 * wiring. It is deliberately GENERIC — it does not enumerate "not
 * surface-panel"; it resolves every colour utility the page paints itself with
 * back to its token and requires that token to hold the SAME value in both
 * theme blocks. Any future chrome token reached for on the page fails here,
 * including ones that do not exist yet.
 */

const TOKENS = readFileSync(
  join(process.cwd(), "..", "..", "packages", "ui-tokens", "src", "tokens.css"),
  "utf8",
);

const SRC = join(process.cwd(), "src");
const FACSIMILE = readFileSync(
  join(SRC, "features", "review", "PageFacsimile.tsx"),
  "utf8",
);
const OVERLAY = readFileSync(
  join(SRC, "entities", "document", "EvidenceOverlay.tsx"),
  "utf8",
);
const FIXTURE = readFileSync(
  join(SRC, "entities", "document", "pageFixture.ts"),
  "utf8",
);

/** Slice out the `{ … }` body that follows the first match of `header`. */
function extractBlock(css: string, header: RegExp): string {
  const start = header.exec(css);
  if (!start) throw new Error(`block header ${header} not found in tokens.css`);
  const open = css.indexOf("{", start.index);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unbalanced braces after ${header}`);
}

/**
 * Every `--color-*` declaration in one theme block, value verbatim.
 *
 * Comments are stripped FIRST, and that is load-bearing rather than tidiness:
 * tokens.css documents `--color-scan` with the prose "Distinct from
 * --color-surface-paper: `paper` is the clean modern print…". Parsed as code
 * that reads as a declaration whose value runs to the next semicolon — it
 * overwrote the real `--color-surface-paper` with a sentence AND swallowed
 * `--color-scan` whole.
 */
function colours(block: string): Map<string, string> {
  const out = new Map<string, string>();
  const code = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of code.matchAll(/--(color-[a-z0-9-]+):\s*([^;]+);/g)) {
    if (m[1] && m[2]) out.set(m[1], m[2].trim());
  }
  return out;
}

const LIGHT = colours(extractBlock(TOKENS, /@theme\s*\{/));
const MOCHA = colours(extractBlock(TOKENS, /\[data-theme="mocha"\]\s*\{/));

/** Comments quote class names in prose; only real string literals are code. */
function classLiteralContaining(src: string, marker: string): string {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const hits = [...code.matchAll(/"([^"\n]*)"/g)]
    .map((m) => m[1] ?? "")
    .filter((s) => s.split(/\s+/).includes(marker));
  if (hits.length !== 1) {
    throw new Error(
      `expected exactly one class literal containing \`${marker}\`, found ${hits.length}`,
    );
  }
  return hits[0] as string;
}

/**
 * Tailwind utility prefixes that take a COLOUR token. `shadow-` and the
 * gradient stops are excluded on purpose: `shadow-page` reads `--shadow-page`,
 * not `--color-page`, and treating it as a colour would make this test claim a
 * pin it never checked.
 */
const COLOUR_UTILITY =
  /^(bg|text|border|fill|stroke|ring|outline|decoration|caret|accent|divide|placeholder)-(.+)$/;

/** The colour tokens a class string actually resolves against. */
function tokensOf(classes: string): { cls: string; token: string }[] {
  const out: { cls: string; token: string }[] = [];
  for (const cls of classes.split(/\s+/)) {
    const m = COLOUR_UTILITY.exec(cls);
    const name = m?.[2] === undefined ? null : `color-${m[2]}`;
    // `text-sm`, `border-2` and friends resolve to no colour token at all.
    if (name !== null && LIGHT.has(name)) out.push({ cls, token: name });
  }
  return out;
}

/** The page's own family. Every one of these is marked PINNED in tokens.css. */
const PINNED = [
  "color-surface-paper",
  "color-page",
  "color-page-ink",
  "color-page-bar",
  "color-page-line",
  "color-scan",
  "color-scan-ink",
  "color-scan-ink-degraded",
  "color-scan-line",
  "color-scan-line-soft",
  "color-surface-evidence",
  "color-border-evidence",
  "color-surface-pin",
] as const;

describe("the pinned page family is genuinely identical in both themes", () => {
  for (const name of PINNED) {
    test(`--${name}`, () => {
      expect(LIGHT.get(name), `--${name} missing from @theme`).toBeDefined();
      expect(MOCHA.get(name), `--${name} missing from [data-theme="mocha"]`).toEqual(
        LIGHT.get(name),
      );
    });
  }
});

describe("the page paints itself from the pinned family, never from UI chrome", () => {
  const surfaces = classLiteralContaining(FACSIMILE, "shadow-page");
  const ink = classLiteralContaining(FACSIMILE, "leading-document");
  const degraded = classLiteralContaining(FACSIMILE, "filter-scan-degraded");
  const mark = classLiteralContaining(OVERLAY, "border-border-evidence");

  const parts = {
    "page sheet": surfaces,
    "page ink": ink,
    "degraded ink": degraded,
    "evidence mark": mark,
  };

  for (const [what, classes] of Object.entries(parts)) {
    const used = tokensOf(classes);

    // Vacuity guard. A prefix regex that silently matches nothing would let
    // every assertion below pass on an empty list — which is exactly how a
    // colour test stops testing colour.
    test(`${what} resolves at least one colour token`, () => {
      expect(
        used.map((u) => u.cls),
        classes,
      ).not.toEqual([]);
    });

    for (const { cls, token } of used) {
      test(`${what}: \`${cls}\` is pinned`, () => {
        expect(
          MOCHA.get(token),
          `\`${cls}\` reads --${token}, which is ${LIGHT.get(token)} in light and ${MOCHA.get(token)} in mocha — the page would change colour with the theme`,
        ).toEqual(LIGHT.get(token));
      });
    }
  }

  test("the sheet carries a background at all", () => {
    expect(
      tokensOf(surfaces).some((u) => u.cls.startsWith("bg-")),
      surfaces,
    ).toBe(true);
  });

  test("the ink carries a text colour at all", () => {
    expect(
      tokensOf(ink).some((u) => u.cls.startsWith("text-")),
      ink,
    ).toBe(true);
  });

  /** The two specific regressions, named, so the diff that reintroduces them is obvious. */
  test("the sheet is not painted with the chrome panel surface", () => {
    expect(surfaces.split(/\s+/)).not.toContain("bg-surface-panel");
  });

  test("the page text is not painted with chrome ink", () => {
    expect(ink.split(/\s+/)).not.toContain("text-ink-primary");
  });
});

describe("the evidence mark survives a dark ground", () => {
  /*
   * `mix-blend-multiply` multiplies the mark into whatever is beneath it. Over
   * a dark ground that product is near-black, so the single most load-bearing
   * mark in the product renders as a redaction bar. Plain alpha compositing is
   * ground-independent: the mark is never less than its own colour at 45%,
   * whatever is under it.
   */
  test("no blend mode is applied to the mark", () => {
    const mark = classLiteralContaining(OVERLAY, "border-border-evidence");
    expect(mark.split(/\s+/).filter((c) => c.startsWith("mix-blend-"))).toEqual([]);
  });
});

describe("the fixture's hard-coded hexes really mirror the tokens they name", () => {
  /*
   * A data-URI SVG has no CSS context, so `pageFixture.ts` mirrors token
   * values by hand under `rules-allow:`. Nothing checked the mirror, and it
   * had drifted: PAPER claimed to mirror --color-surface-paper while holding a
   * value that token has not had since the warm-archival revision.
   */
  const declarations = [
    ...FIXTURE.matchAll(/const (\w+) = "(#[0-9a-fA-F]{6})";.*?mirrors --([a-z0-9-]+)/g),
  ];

  test("every mirrored constant is discoverable", () => {
    expect(declarations.length).toBeGreaterThan(0);
  });

  for (const [, name, value, token] of declarations) {
    test(`${name} mirrors --${token}`, () => {
      expect(LIGHT.get(token as string), `--${token} is not a token`).toBeDefined();
      expect(value?.toLowerCase()).toEqual(LIGHT.get(token as string)?.toLowerCase());
    });
  }

  test("the fixture only mirrors tokens that are pinned", () => {
    const named = declarations.map((d) => d[3] as string);
    expect(named.filter((t) => !PINNED.includes(t as (typeof PINNED)[number]))).toEqual(
      [],
    );
  });
});
