import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * The token-arithmetic gate, over `packages/ui-tokens/src/tokens.css`.
 *
 * tokens.css asserted for months that its radius scale was "asserted in
 * apps/web-v2/src/shared/tokens.test.ts" and that enforcement was "three
 * layers deep". That file has never existed in this repo — `apps/web-v2` was
 * deleted at the rebuild — so one of the three layers was fiction, and the
 * radius relationship was held by a single Storybook story. This file is that
 * missing layer, made real.
 *
 * Two invariants, both stated in tokens.css and neither previously provable:
 *
 *   1. CONTRAST. `--color-ink-faint` is the ink on every 11px label, spent at
 *      ~65 call sites. Its original design-system value (#8a8e98) failed WCAG
 *      2.2 AA for normal text on every surface in the palette. Because the
 *      cost of the screen-by-screen fix scaled with the call sites and the
 *      cost of the token fix did not, the token moved. This pins it there.
 *
 *   2. RADII. `inner = outer − gap`, the relationship the whole component kit
 *      composes against: a 6px cell inside a 10px input inside a 14px surface,
 *      with the 4px step being `--space-2`. A redesign that moves one radius
 *      without the others breaks every nested corner in the app, silently,
 *      because Tailwind emitting no class is not an error.
 */

const TOKENS = readFileSync(
  join(process.cwd(), "..", "..", "packages", "ui-tokens", "src", "tokens.css"),
  "utf8",
);

/** Reads a `--name: #rrggbb;` declaration. Fails loudly if the token is gone. */
function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(TOKENS);
  expect(match, `token --${name} is missing from tokens.css`).not.toBeNull();
  return match![1].toLowerCase();
}

/** Reads a `--name: Npx;` declaration. */
function px(name: string): number {
  const match = new RegExp(`--${name}:\\s*(\\d+)px\\b`).exec(TOKENS);
  expect(match, `token --${name} is missing from tokens.css`).not.toBeNull();
  return Number(match![1]);
}

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(ink: string, surface: string): number {
  const [lighter, darker] = [luminance(ink), luminance(surface)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Every opaque surface `--color-ink-faint` can be painted on. The alpha
 * surfaces (`--color-surface-evidence`, `--color-surface-pin`) are excluded:
 * they composite over one of these, so they are strictly lighter-or-equal
 * cases of a row already here, and a flat hex cannot express them.
 */
const OPAQUE_SURFACES = [
  "surface-app",
  "surface-panel",
  "surface-sunken",
  "surface-viewer",
  "surface-paper",
] as const;

/** WCAG 2.2 AA, normal text. Large text (3:1) is not a licence here: the
 *  token's whole job is the 11px label, which is never large text. */
const AA_NORMAL_TEXT = 4.5;

test("--color-ink-faint clears AA on every surface it can be painted on", () => {
  const faint = token("color-ink-faint");
  const failures: string[] = [];

  for (const surface of OPAQUE_SURFACES) {
    const ratio = contrast(faint, token(`color-${surface}`));
    if (ratio < AA_NORMAL_TEXT) {
      failures.push(`${surface}: ${ratio.toFixed(2)}:1`);
    }
  }

  expect(
    failures,
    `--color-ink-faint (${faint}) is the ink on every 11px label and must ` +
      `clear ${AA_NORMAL_TEXT}:1 on each surface. Below the floor on: ` +
      failures.join(", "),
  ).toEqual([]);
});

test("radii keep inner = outer − gap", () => {
  const gap = px("space-2");
  expect(gap, "--space-2 is the 4px step the radius scale subtracts").toBe(4);

  expect(px("radius-sm"), "sm must be md − space-2").toBe(px("radius-md") - gap);
  expect(px("radius-md"), "md must be lg − space-2").toBe(px("radius-lg") - gap);
});
