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
  if (!m?.[1])
    throw new Error(
      `token --${name} not found for theme "${theme}" or not a 6-digit hex`,
    );
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
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
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
 * REWRITTEN 2026-08-01. The pane used to be LIGHT in the light theme (#dcdde3,
 * from D2's reversal) and dark only in Mocha, so the permitted list was the
 * chrome's own primary/secondary inks. The approved hybrid mockup draws the
 * reading room DARK (`--surround` #383129) and tokens.css now holds that value
 * in BOTH theme blocks — one document register, not two.
 *
 * That flips which inks are legal. Chrome ink is a DARK colour in the light
 * theme, so on a near-black pane `--color-ink-primary` measures 1.32:1 and
 * `--color-ink-secondary` 2.55:1: the pane can no longer borrow from the chrome
 * at all. It keeps the vocabulary that was built for it —
 * `--color-document-ink*` — and because that family is shared across themes,
 * this block now measures the same numbers twice, on purpose.
 */
const PERMITTED_ON_DOCUMENT = [
  "color-document-ink",
  "color-document-ink-soft",
  "color-document-ink-strong",
] as const;

/**
 * Chrome inks that must NOT be legible on the document pane. Not a curiosity —
 * it is the exact regression `documentIsPaper.test.ts` was written after: a
 * component reaching for a chrome token on the page. This pins the arithmetic
 * side of the same rule, so "just use text-ink-primary there" cannot pass a
 * palette review.
 */
const FORBIDDEN_ON_DOCUMENT_LIGHT = [
  "color-ink-primary",
  "color-ink-secondary",
  "color-ink-muted",
] as const;

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

  /*
   * The pane is a near-black surround in BOTH themes now, so the light theme's
   * dark chrome inks are simply unavailable on it — all three of them, not just
   * the quiet tier. Measured on #383129: primary 1.32:1, secondary 2.55:1,
   * muted 2.00:1. Darkening any of them to "fix" this is not a move that
   * exists; the pane has its own family and that is the whole point.
   */
  for (const ink of FORBIDDEN_ON_DOCUMENT_LIGHT) {
    test(`light: ${ink} is NOT usable on the document pane`, () => {
      const r = ratio(token(ink, "light"), token("color-surface-document", "light"));
      expect(
        r,
        `${r.toFixed(2)}:1 — chrome ink must not be reached for on the pane`,
      ).toBeLessThan(AA_NORMAL);
    });
  }

  /*
   * NOT the same claim in Mocha, and this is not an oversight — it is the
   * mirror image, provably. Mocha's inks are LIGHT colours (text / subtext0)
   * and the pane is a dark surround, so the gap is wide by construction rather
   * than marginal. Asserting "NOT permitted" here would encode a false claim
   * about this palette instead of documenting a real constraint. Measured:
   * 5.76:1 for the quiet tier, the tightest of the three.
   */
  test("mocha: --color-ink-muted DOES clear AA there — the light-theme restriction does not carry over", () => {
    const r = ratio(
      token("color-ink-muted", "mocha"),
      token("color-surface-document", "mocha"),
    );
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

describe("base state colours are never safe as text (light palette — not extended to Mocha, see comment)", () => {
  /**
   * REWRITTEN 2026-08-01 for the hybrid warm-paper palette, and the rewrite
   * RESTORES the original blanket claim rather than narrowing it.
   *
   * History, because the value of this block is that it keeps being re-measured
   * rather than re-asserted. The 2026-07-28 navy/oxblood/ochre palette made two
   * of these three pairings clear AA, so the block was rewritten to pin a mixed
   * reality: `-ink` was a hierarchy choice for attend-on-tint and
   * settled-on-app, and a legibility floor only for the rest. A's warm palette
   * is lighter and warmer than that one — the ground dropped from #eae7e0 to
   * #E3DCCA and the tints lifted — and all three pairings fail again. Measured
   * against the shipped values:
   *
   *   attend  (#96690F) on attend-surface (#F3E8CD)  3.99:1  <- fails again
   *   attend  (#96690F) on app background (#E3DCCA)  3.55:1  <- still fails
   *   settled (#45714B) on app background (#E3DCCA)  4.13:1  <- fails again
   *
   * So `Chip` and `Eyebrow` using the `-ink` variant for every state is once
   * more a LEGIBILITY FLOOR, not a taste decision. The base tones are for
   * borders, dots, bars and icons; they are not text. A future palette that
   * makes one of them legible as text should flip the assertion back — with
   * the measurement, as both previous revisions did.
   *
   * NOT looped across THEMES. This documents a specific empirical fact about
   * the LIGHT palette's dark-ink-on-light-surface arithmetic, and the fact
   * inverts in Mocha rather than generalising: base state colours there
   * (mauve/green/peach/red) are light/pastel and the surfaces they would sit
   * against are dark, so "base accent on app background" is high-contrast by
   * construction. Measured for confirmation: peach #fab387 on base #1e1e2e is
   * 9.27:1. Duplicating `toBeLessThan(AA_NORMAL)` under a theme loop would
   * assert something false about Mocha.
   */
  test("base attend on its own tint is below AA", () => {
    const r = ratio(token("color-state-attend"), token("color-state-attend-surface"));
    expect(r, `${r.toFixed(2)}:1`).toBeLessThan(AA_NORMAL);
  });

  test("base attend on the app background is below AA", () => {
    const r = ratio(token("color-state-attend"), token("color-surface-app"));
    expect(r, `${r.toFixed(2)}:1`).toBeLessThan(AA_NORMAL);
  });

  test("base settled on the app background is below AA", () => {
    const r = ratio(token("color-state-settled"), token("color-surface-app"));
    expect(r, `${r.toFixed(2)}:1`).toBeLessThan(AA_NORMAL);
  });
});

/**
 * THE ACCENT/HALT SEPARATION, AS A GATE.
 *
 * ADDED 2026-08-01 with the sealing-wax palette. The accent is now red
 * (#8A3222) and `--color-state-halt` was an oxblood a hair away from it, so
 * "press this" and "this order is stopped" were about to become the same
 * colour on a tool where that distinction is load-bearing. tokens.css resolves
 * it in three parts (hue, lightness, stroke); the two mechanical parts are
 * pinned here so a later palette edit cannot quietly re-collapse them.
 *
 * These are RATIOS BETWEEN TWO PALETTE COLOURS, not text contrast — the point
 * is greyscale separability, which is exactly what the WCAG luminance ratio
 * measures when you strip hue out of the question.
 */
describe("the primary action and the halt state stay separable in greyscale", () => {
  /**
   * The bases. 1.5 is not a WCAG number; it is the floor below which the two
   * accents are the same grey to a reader who is scanning rather than
   * comparing. Measured at the shipped values: 1.65:1.
   *
   * There is no room to demand more. `--color-action` sits at luminance .0780
   * and `--color-ink-primary` at .0122; any halt placed between them is at best
   * 1.43:1 from BOTH, so a bigger gap from the accent buys an indistinguishable
   * halt-vs-body-text instead. That ceiling is why the stroke test below exists
   * and why it carries the heavier threshold.
   */
  test("--color-state-halt is a real lightness step below --color-action", () => {
    const r = ratio(token("color-action"), token("color-state-halt"));
    expect(
      r,
      `action vs halt is ${r.toFixed(2)}:1 — the two would read as one grey`,
    ).toBeGreaterThanOrEqual(1.5);
  });

  /**
   * The strokes, in BOTH themes — this is the mechanism that actually survives
   * greyscale at 9.5px. A halt chip is an OUTLINED object; an action chip is an
   * unoutlined tint. Light measures 2.09:1, Mocha 2.30:1.
   *
   * If someone "tidies" halt-border into the same tint family as action-border,
   * every state chip in the app becomes a pale rectangle and this fails.
   */
  for (const theme of THEMES) {
    test(`--color-state-halt-border reads as a stroke against --color-action-border — ${theme}`, () => {
      const r = ratio(
        token("color-state-halt-border", theme),
        token("color-action-border", theme),
      );
      expect(
        r,
        `halt border vs action border is ${r.toFixed(2)}:1 in ${theme} — the outline cue is gone`,
      ).toBeGreaterThanOrEqual(1.8);
    });
  }

  /**
   * And the halt border must be a stroke against the thing it is drawn ON, not
   * merely against the action's hairline. A 2:1 gap between two invisible
   * borders would satisfy the test above and nothing else.
   */
  for (const theme of THEMES) {
    test(`--color-state-halt-border is visible on --color-state-halt-surface — ${theme}`, () => {
      const r = ratio(
        token("color-state-halt-border", theme),
        token("color-state-halt-surface", theme),
      );
      expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(2);
    });
  }
});

/**
 * `color-state-attend` and `color-state-idle` were ADDED to this sweep
 * 2026-08-01. They were missing, and the omission was not free: the palette
 * check passed while `Chip`/`Badge` filled a solid attend swatch under
 * `--color-ink-on-action` at 4.42:1, and only the Storybook axe run — which
 * had just started compiling Tailwind for real — caught it. Exactly the
 * failure mode this file's header describes: a tier gets checked, the next one
 * is never checked at all. Every base colour this app fills belongs here.
 */
describe("ink-on-action clears AA on every filled control", () => {
  for (const theme of THEMES) {
    for (const fill of [
      "color-action",
      "color-state-settled",
      "color-state-attend",
      "color-state-halt",
      "color-state-idle",
    ] as const) {
      test(`--color-ink-on-action on ${fill} — ${theme}`, () => {
        const r = ratio(token("color-ink-on-action", theme), token(fill, theme));
        expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});

/**
 * THE NAVIGATOR IS THE SECOND SURFACE WITH ITS OWN INK VOCABULARY, and it is
 * gated here for the same reason the document pane is: the rail went dark on
 * 2026-08-13, and a dark column under a light app is exactly the configuration
 * nobody screenshots. Every failure it hides is total rather than marginal.
 *
 * The numbers that made this a gate rather than a note, measured on
 * `--color-rail-surface` in the light theme. RE-MEASURED 2026-08-14 — the muted
 * figure below was first written as 1.70:1, wrong, and repeated into four
 * component files as the justification for the change. The conclusion held; the
 * arithmetic did not, in a block whose whole claim is that it was measured.
 *   --color-ink-primary    1.00:1   identical luminance — the wordmark was blank
 *   --color-ink-secondary  2.22:1   the tier the resting row label used to read
 *   --color-ink-muted      2.64:1   every group header and every resting mark
 *   --color-action         2.06:1   the seal, `Pipe`, and the FOCUS RING
 *   --color-state-halt     1.24:1   the attention dot and the halt badge's fill
 *   --color-state-settled  2.99:1   the done stage disc and the walked spine
 *
 * A first pass drew the group headers at #79768f (3.86:1) and the marked row as
 * a literal `bg-white`/`text-slate-900` pair — under AA, and frozen against
 * `[data-theme="mocha"]`. A second gave the light theme TWO grounds, a dark
 * column and a paper band, and four filled descendants broke on one or the
 * other. Both are what these tests exist to refuse, which is why every ink is
 * now asserted against BOTH grounds rather than against whichever one suited it.
 */
describe("the navigator has its own ink vocabulary", () => {
  /**
   * THE RAIL HAS TWO GROUNDS AND EVERY MARK MUST SURVIVE BOTH: the column, and
   * the marked row's band, which is a lift of the column rather than a separate
   * material. Asserting against only one is how the earlier passes shipped —
   * the paper band flattered whatever stood on it and the column did not, so a
   * per-ground list simply encoded which defect had not been noticed yet.
   *
   * TEXT, at AA.
   */
  const RAIL_TEXT = [
    "color-rail-ink",
    "color-rail-ink-active",
    "color-rail-ink-secondary",
    "color-rail-ink-muted",
    "color-rail-accent",
  ] as const;

  /**
   * MARKS, at the 3:1 non-text bar — dots, discs, spines, the focus ring. Every
   * one of these is a thing no text-contrast tool will ever look at: axe
   * measures text, so a filled `<span>` or a 1px rule is invisible to the
   * Storybook a11y run that covers the rest of this rail.
   */
  const RAIL_MARKS = [
    "color-rail-attention-halt",
    "color-rail-attention-attend",
    "color-rail-halt-surface",
    "color-rail-settled",
    "color-rail-track",
  ] as const;

  const GROUNDS = ["color-rail-surface", "color-rail-active-surface"] as const;

  for (const theme of THEMES) {
    for (const ground of GROUNDS) {
      for (const ink of RAIL_TEXT) {
        test(`${ink} clears AA on ${ground} — ${theme}`, () => {
          const r = ratio(token(ink, theme), token(ground, theme));
          expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }

      for (const mark of RAIL_MARKS) {
        test(`${mark} is visible on ${ground} — ${theme}`, () => {
          const r = ratio(token(mark, theme), token(ground, theme));
          expect(
            r,
            `${r.toFixed(2)}:1 — a rail mark below the 3:1 non-text bar`,
          ).toBeGreaterThanOrEqual(3);
        });
      }
    }

    /*
     * THE FILLED BADGE CARRIES A NUMERAL, so its fill is gated at AA against
     * the ink on it and not merely at the 3:1 it clears as a shape. This is why
     * `--color-rail-halt-surface` is a different value from the halt DOT in the
     * light theme: the dot's colour holds text at only 4.10:1.
     */
    test(`the halt badge's numerals clear AA on its fill — ${theme}`, () => {
      const r = ratio(
        token("color-rail-surface", theme),
        token("color-rail-halt-surface", theme),
      );
      expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    /*
     * THE FLOW RAIL'S ORDER, which no contrast bar expresses. A walked segment
     * means "behind you" and must read LOUDER than the track ahead of it. Both
     * cleared 3:1 individually while running backwards: the app tokens put the
     * un-walked spine at 11.10:1 against the walked one at 2.99:1.
     */
    test(`the walked spine reads louder than the track ahead — ${theme}`, () => {
      const column = token("color-rail-surface", theme);
      const walked = ratio(token("color-rail-settled", theme), column);
      const ahead = ratio(token("color-rail-track", theme), column);
      expect(
        walked,
        `walked ${walked.toFixed(2)}:1 vs ahead ${ahead.toFixed(2)}:1 — the spine runs backwards`,
      ).toBeGreaterThan(ahead);
    });

    /*
     * The band has to be perceptible as a band, which no ink ratio proves. The
     * bar is 1.2:1 in BOTH themes and deliberately low: the lift is a whisper
     * and the accent bar at the margin is what says "here". An earlier version
     * of this test set the light bar at 3 and the mocha bar at 1.4 against an
     * observed 1.60 — a floor beneath the value it measured, which could not
     * fail, dressed as a theme-specific allowance. One bar, both themes.
     */
    test(`the marked row separates from the column — ${theme}`, () => {
      const r = ratio(
        token("color-rail-active-surface", theme),
        token("color-rail-surface", theme),
      );
      expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.2);
    });
  }

  /*
   * THE FOCUS RING IS A MARK ON THE COLUMN, and it is asserted here because it
   * is drawn in CSS rather than by any component: `index.css` rings the app with
   * `--color-action` and `rail.css` overrides that to `--color-rail-accent`
   * inside the rail. Without the override the ring measures 2.06:1 in the light
   * theme — no visible focus indicator on any door, stage or the fold button.
   * `--color-action` is asserted as NOT sufficient so the override cannot be
   * deleted as redundant.
   */
  for (const theme of THEMES) {
    test(`the rail's focus ring is visible on the column — ${theme}`, () => {
      const r = ratio(
        token("color-rail-accent", theme),
        token("color-rail-surface", theme),
      );
      expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });
  }

  test("light: --color-action alone is NOT a usable focus ring on the rail", () => {
    const r = ratio(
      token("color-action", "light"),
      token("color-rail-surface", "light"),
    );
    expect(
      r,
      `${r.toFixed(2)}:1 — the app-wide ring needs the rail override`,
    ).toBeLessThan(3);
  });

  /*
   * THE APP'S INK TIERS ARE NOT AVAILABLE HERE. Same shape as the document
   * pane's restriction, and same purpose: state the constraint as a test so
   * that reaching for `text-ink-primary` on the rail fails a build instead of
   * shipping a blank column. Light theme only — in Mocha the app inks are light
   * colours and clear the dark column by construction, so asserting it there
   * would encode a false claim (the pane's block above makes the identical
   * distinction, for the identical reason).
   */
  for (const ink of [
    "color-ink-primary",
    "color-ink-secondary",
    "color-ink-muted",
  ] as const) {
    test(`light: ${ink} is NOT usable on the rail`, () => {
      const r = ratio(token(ink, "light"), token("color-rail-surface", "light"));
      expect(
        r,
        `${r.toFixed(2)}:1 — app ink must not be reached for on the rail`,
      ).toBeLessThan(AA_NORMAL);
    });
  }
});
