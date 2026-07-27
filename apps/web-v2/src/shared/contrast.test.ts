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

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(TOKENS);
  if (!m?.[1]) throw new Error(`token --${name} not found or not a 6-digit hex`);
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
  for (const ink of INKS) {
    for (const surface of SURFACES) {
      test(`${ink} on ${surface}`, () => {
        const r = ratio(token(ink), token(surface));
        expect(
          r,
          `${ink} on ${surface} is ${r.toFixed(2)}:1, below AA ${AA_NORMAL}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});

describe("the light document pane has its own ink vocabulary", () => {
  for (const ink of PERMITTED_ON_DOCUMENT) {
    test(`${ink} clears AA on the document pane`, () => {
      const r = ratio(token(ink), token("color-surface-document"));
      expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }

  test("--color-ink-muted is NOT permitted there — it measures below AA", () => {
    // Not an oversight. Darkening muted to clear this surface would collapse it
    // into --color-ink-secondary and destroy a tier the design uses heavily.
    const r = ratio(token("color-ink-muted"), token("color-surface-document"));
    expect(r).toBeLessThan(AA_NORMAL);
  });
});

describe("every state ink clears AA on its own tint", () => {
  for (const [ink, surface] of ON_TINT) {
    test(`${ink} on ${surface}`, () => {
      const r = ratio(token(ink), token(surface));
      expect(
        r,
        `${ink} on ${surface} is ${r.toFixed(2)}:1, below AA ${AA_NORMAL}:1`,
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }
});

describe("the base state colours are NOT safe as text on their own tints", () => {
  /**
   * Pins the reason `Chip` and `Eyebrow` use `-ink` rather than the base. If a
   * future edit "simplifies" them back to `text-state-attend`, this test states
   * plainly why that is wrong — it is a note that executes.
   */
  test("base attend on attend-surface is below AA — use --color-state-attend-ink", () => {
    expect(ratio(token("color-state-attend"), token("color-state-attend-surface")))
      .toBeLessThan(AA_NORMAL);
  });

  test("base attend on the app background is below AA", () => {
    expect(ratio(token("color-state-attend"), token("color-surface-app")))
      .toBeLessThan(AA_NORMAL);
  });

  test("base settled on the app background is below AA", () => {
    expect(ratio(token("color-state-settled"), token("color-surface-app")))
      .toBeLessThan(AA_NORMAL);
  });
});

describe("white on a filled control clears AA", () => {
  for (const fill of ["color-action", "color-state-settled", "color-state-halt"] as const) {
    test(`--color-ink-on-action on ${fill}`, () => {
      const r = ratio(token("color-ink-on-action"), token(fill));
      expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }
});
