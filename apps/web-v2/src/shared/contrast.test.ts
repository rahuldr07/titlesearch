import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * WCAG contrast as a BUILD GATE, not a one-off measurement.
 *
 * Five AA failures shipped before this existed, and every one was found by a
 * human re-measuring by hand: `--color-ink-muted`, `--color-na-not-present-ink`,
 * and then `--color-state-attend`/`-settled` on three different surfaces. The
 * pattern is always the same — a tier gets checked, the fix gets documented as
 * "clears AA everywhere", and the next tier is never checked at all.
 *
 * This reads the shipped token file and measures every ink against every
 * surface it can plausibly sit on. It cannot be satisfied by a comment.
 *
 * Scope note: this proves the PALETTE is sound. It cannot prove a component
 * pairs tokens correctly — `Chip` passed a palette check for weeks while
 * pairing a base colour with a tint. Component pairings are covered by axe on
 * the Storybook run, which catches real rendered contrast.
 */

const TOKENS = readFileSync(
  join(process.cwd(), "..", "..", "packages", "ui-tokens", "src", "tokens.css"),
  "utf8",
);

/**
 * Two themes, same token names (HANDOFF-UI §8): `@theme { … }` is TitlePipe
 * light, `[data-theme="mocha"] { … }` is Catppuccin Mocha dark. Both blocks
 * declare every `--color-*` name once, so extracting each block's own text
 * before running the per-token regex is what keeps `token(name, "mocha")`
 * from accidentally matching the light value that happens to come first in
 * the file.
 */
const THEMES = ["light", "mocha"] as const;
type Theme = (typeof THEMES)[number];

/** Slice out the `{ … }` body that follows the first match of `header` in `css`. */
function extractBlock(css: string, header: RegExp): string {
  const start = header.exec(css);
  if (!start) throw new Error(`block header ${header} not found in tokens.css`);
  const openBrace = css.indexOf("{", start.index);
  if (openBrace === -1) throw new Error(`no { after ${header} in tokens.css`);
  let depth = 0;
  for (let i = openBrace; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(openBrace + 1, i);
    }
  }
  throw new Error(`unbalanced braces after ${header} in tokens.css`);
}

const THEME_BLOCKS: Record<Theme, string> = {
  light: extractBlock(TOKENS, /@theme\s*\{/),
  mocha: extractBlock(TOKENS, /\[data-theme="mocha"\]\s*\{/),
};

function token(name: string, theme: Theme = "light"): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(THEME_BLOCKS[theme]);
  if (!m?.[1]) throw new Error(`token --${name} not found for theme "${theme}" or not a 6-digit hex`);
  return m[1];
}

function luminance(hex: string): number {
  const parts = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const [r, g, b] = parts as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The chrome surfaces any UI text can land on. */
const SURFACES = [
  "color-surface-panel",
  "color-surface-app",
  "color-surface-sunken",
  "color-surface-raised",
] as const;

/** Inks used for real text anywhere in the app. */
const INKS = [
  "color-ink-primary",
  "color-ink-secondary",
  "color-ink-muted",
  "color-action-ink",
  "color-state-settled-ink",
  "color-state-attend-ink",
  "color-state-halt-ink",
  "color-na-not-present-ink",
  "color-na-not-found-ink",
  "color-na-silent-ink",
] as const;

/**
 * `--color-surface-document` is deliberately NOT in SURFACES, and this is a
 * constraint rather than an omission — the distinction that matters, because
 * the last four contrast bugs were all omissions dressed as completeness.
 *
 * That surface (#dcdde3) is the light document pane D2's reversal introduced.
 * It is darker than any chrome surface, and the quiet `--color-ink-muted` tier
 * measures 4.24:1 on it — below AA. Darkening muted until it clears would push
 * it to within one step of `--color-ink-secondary`, collapsing two tiers the
 * design genuinely uses (70 of 133 eyebrows are the muted tier).
 *
 * So the pane keeps its own ink vocabulary: primary and secondary in the light
 * register, `--color-document-ink*` in the dark one. The muted tier is not
 * available there. `PERMITTED_ON_DOCUMENT` states that, and the test below
 * pins the failure so nobody "fixes" it by reaching for muted.
 */
const PERMITTED_ON_DOCUMENT = ["color-ink-primary", "color-ink-secondary"] as const;

/** Each state's ink against its OWN tint — the pairing chips and buttons use. */
const ON_TINT: ReadonlyArray<readonly [string, string]> = [
  ["color-action-ink", "color-action-surface"],
  ["color-state-settled-ink", "color-state-settled-surface"],
  ["color-state-attend-ink", "color-state-attend-surface"],
  ["color-state-halt-ink", "color-state-halt-surface"],
  ["color-na-unreadable-ink", "color-na-unreadable-surface"],
];

const AA_NORMAL = 4.5;

describe("every ink clears AA on every surface it can sit on", () => {
  for (const theme of THEMES) {
    for (const ink of INKS) {
      for (const surface of SURFACES) {
        test(`${ink} on ${surface} — ${theme}`, () => {
          const r = ratio(token(ink, theme), token(surface, theme));
          expect(
            r,
            `${ink} on ${surface} is ${r.toFixed(2)}:1 in ${theme}, below AA ${AA_NORMAL}:1`,
          ).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    }
  }
});

describe("the document pane has its own ink vocabulary", () => {
  for (const theme of THEMES) {
    for (const ink of PERMITTED_ON_DOCUMENT) {
      test(`${ink} clears AA on the document pane — ${theme}`, () => {
        const r = ratio(token(ink, theme), token("color-surface-document", theme));
        expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }

  test("light: --color-ink-muted is NOT permitted there — it measures below AA", () => {
    // Not an oversight. Darkening muted to clear this surface would collapse it
    // into --color-ink-secondary and destroy a tier the design uses heavily.
    const r = ratio(token("color-ink-muted", "light"), token("color-surface-document", "light"));
    expect(r, `${r.toFixed(2)}:1`).toBeLessThan(AA_NORMAL);
  });

  /*
   * NOT the same claim in Mocha, and this is not an oversight either — it is
   * the mirror image, provably. In light, --color-surface-document (#dcdde3)
   * is darker than the chrome, which is what makes light-on-... no: muted
   * ink is a DARK colour there, and the document pane being darker-than-chrome
   * shrinks the gap. In Mocha, ink is a LIGHT colour (subtext0) and
   * --color-surface-document is a dark pane surround (rule 1: the surround
   * darkens, the page doesn't) — darkening the surface only widens the gap
   * for light-coloured ink. Measured: 6.89:1, comfortably above AA. Asserting
   * "NOT permitted" here would encode a false claim about this palette, not
   * document a real constraint — see task-2-report.md for the fuller
   * argument.
   */
  test("mocha: --color-ink-muted DOES clear AA there — the light-theme restriction does not carry over", () => {
    const r = ratio(token("color-ink-muted", "mocha"), token("color-surface-document", "mocha"));
    expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe("every state ink clears AA on its own tint", () => {
  for (const theme of THEMES) {
    for (const [ink, surface] of ON_TINT) {
      test(`${ink} on ${surface} — ${theme}`, () => {
        const r = ratio(token(ink, theme), token(surface, theme));
        expect(
          r,
          `${ink} on ${surface} is ${r.toFixed(2)}:1 in ${theme}, below AA ${AA_NORMAL}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});

describe("base state colours (light palette history — not extended to Mocha, see comment)", () => {
  /**
   * REWRITTEN 2026-07-28 for the warm-archival palette. The old cool/violet
   * palette made this block's premise literally true everywhere it checked:
   * every base state colour failed AA as text on its own tint / the app
   * background, so `Chip`/`Eyebrow` used the `-ink` variant purely to stay
   * legible. The new navy/oxblood/ochre family is not uniformly less legible
   * — `--color-state-attend` (#8a6413) now clears AA on its own tint
   * (`--color-state-attend-surface`), and `--color-state-settled` (#2f6d46)
   * now clears AA on the app background. Measured:
   *
   *   attend  on attend-surface  4.63:1  <- now clears AA (was a failure)
   *   attend  on app background  4.35:1  <- still fails AA (unchanged)
   *   settled on app background  5.01:1  <- now clears AA (was a failure)
   *
   * `Chip` and `Eyebrow` still use `-ink` for every state, and that is
   * correct — but it is now a DELIBERATE STATE-TEXT HIERARCHY choice (one
   * consistent "text tone" per state, distinct from the "accent tone" used
   * for borders/icons, across all four states alike) rather than a legibility
   * floor. This block pins the new, mixed reality instead of a blanket "base
   * is never safe" claim that would now be false for two of these three
   * pairings.
   *
   * NOT looped across THEMES 2026-07-29. This block documents a specific
   * empirical fact about the LIGHT palette's dark-ink-on-light-surface
   * arithmetic, and the fact inverts in Mocha rather than generalising: base
   * state colours there (mauve/green/peach/red) are light/pastel and the
   * surfaces they'd sit against (app/tint) are dark, so "base accent on app
   * background" is high-contrast by construction, not marginal. Measured for
   * confirmation: --color-state-attend (peach #fab387) on
   * --color-surface-app (base #1e1e2e) in Mocha is 9.27:1 — nowhere near the
   * light palette's still-fails 4.35:1, because the roles of ink and surface
   * swap which one is the "light" quantity. Mechanically duplicating this
   * block's `toBeLessThan(AA_NORMAL)` assertion under a theme loop would
   * assert something false about Mocha; see task-2-report.md.
   */
  test("base attend on attend-surface now clears AA — -ink there is a hierarchy choice, not a legibility floor", () => {
    const r = ratio(token("color-state-attend"), token("color-state-attend-surface"));
    expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  test("base attend on the app background is still below AA", () => {
    const r = ratio(token("color-state-attend"), token("color-surface-app"));
    expect(r, `${r.toFixed(2)}:1`).toBeLessThan(AA_NORMAL);
  });

  test("base settled on the app background now clears AA — -ink there is a hierarchy choice, not a legibility floor", () => {
    const r = ratio(token("color-state-settled"), token("color-surface-app"));
    expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe("ink-on-action clears AA on every filled control", () => {
  for (const theme of THEMES) {
    for (const fill of ["color-action", "color-state-settled", "color-state-halt"] as const) {
      test(`--color-ink-on-action on ${fill} — ${theme}`, () => {
        const r = ratio(token("color-ink-on-action", theme), token(fill, theme));
        expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});
