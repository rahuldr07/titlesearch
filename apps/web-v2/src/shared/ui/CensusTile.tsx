import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { cn } from "./classNames";

/**
 * A CENSUS, NEVER A RATE — and the NAME is the enforcement. Every figure this
 * draws answers "how many are sitting here right now": not per person, not
 * against a target, not divided by an hour. HANDOFF-UI §4.5 makes that a
 * release blocker, and a blocker held only by reviewer memory eventually ships.
 * `StatTile.perHour` reads like a reasonable feature request; the same prop on
 * a CensusTile reads as a category error, so the refusal argues itself.
 *
 * This component never adds anything up. Five call sites, eleven tiles, and
 * three of them were private near-misses of each other that had already drifted
 * to three numeral sizes and two colour vocabularies.
 *
 * TONE IS STATE, NOT EMPHASIS. The action accent means "stopped on a person",
 * which is the product working correctly — most of the pipeline is meant to be
 * waiting on somebody. It is not the alarm colour by hue alone: accent and
 * halt are separated by hue plus a second axis (lightness + stroke, tokens.css
 * header), so the two stay apart in greyscale. Halt is kept for the figure
 * where the order is in no stage at all and nothing will move it.
 *
 * An UNTONED tile is the loudest ink, not the quietest: on a census tile the
 * figure is the content. `tone="muted"` is therefore a real choice — the
 * deliberately receded figure (a retired count, a no-source count that must not
 * out-shout the actionable one) — and not the absence of one.
 *
 * MONO NUMERALS WITH `tnum`, because these get compared against the package a
 * person is holding, and because a 1 beside a 7 stops lining up the moment a
 * figure changes width. Geist Mono's default figures are NOT tabular — the
 * mockup reaches for `.mono{font-feature-settings:"tnum" 1}` on every count it
 * draws — so without the utility a census that ticks 9 → 10 shifts its own
 * caption sideways, and a column of tiles stops being a column.
 */
const NUMERAL_TONE = {
  muted: "text-ink-muted",
  action: "text-action",
  attend: "text-state-attend-ink",
  halt: "text-state-halt-ink",
  settled: "text-state-settled-ink",
} as const;

/**
 * Both tiers are drawn: 21px where the tile IS the content of a board, 13px
 * where it rides along in the chrome strip. One component, because a size is
 * not a different claim — and the strip carries no padding of its own because
 * the chrome sets its own rhythm around it.
 */
const NUMERAL_SIZE = {
  strip: "text-census",
  board: "text-3xl",
} as const;

/**
 * THE STRIP READS ON ONE LINE; THE BOARD READS IN TWO. This is the reskin's one
 * structural change here, and it is the whole of what "match the mockup's
 * strip" means: `.rstrip .stat` is `display:flex;align-items:center;gap:6px`
 * with the figure and its word side by side — `21 FIELDS`, `6 NEED YOU` — read
 * as a phrase at a glance. Stacked, the same tile put a 9.5px caption under a
 * 13px numeral inside 26px of chrome, which either overflows the strip or
 * crushes the two lines into each other; four of them in a row then read as
 * eight unrelated fragments rather than four counts. A board tile, which owns
 * its cell, keeps the stack — there the figure is the content and the caption
 * is its footnote.
 *
 * `items-baseline`, not `items-center`: the mockup centres a 13px numeral
 * against a 9.5px cap, and at that ratio the cap floats. Baselines are what a
 * reader actually aligns on, and they hold when a tone changes the weight.
 *
 * The caption takes `font-semibold` here because the mockup's strip label is
 * 600 where its board caption is unweighted — on one line the word has to hold
 * its own against the numeral instead of receding beneath it.
 */
const SIZE_LAYOUT = {
  strip: "flex items-baseline gap-3",
  board: "flex-1 basis-75 px-9 py-5.5",
} as const;

export interface CensusTileProps {
  value: ReactNode;
  caption: ReactNode;
  /** The state colour. Omit for the ordinary figure — it draws in primary ink. */
  tone?: keyof typeof NUMERAL_TONE;
  size?: keyof typeof NUMERAL_SIZE;
  /** The divider BETWEEN tiles. The last tile in a row never takes one. */
  edge?: boolean;
}

export function CensusTile({
  value,
  caption,
  tone,
  size = "board",
  edge = false,
}: CensusTileProps) {
  return (
    <div className={cn(SIZE_LAYOUT[size], edge && "border-r border-line-subtle")}>
      <p
        className={cn(
          "tnum font-mono leading-flat font-semibold",
          NUMERAL_SIZE[size],
          tone ? NUMERAL_TONE[tone] : "text-ink-primary",
        )}
      >
        {value}
      </p>
      <Eyebrow
        variant="stat"
        as="p"
        className={size === "strip" ? "font-semibold" : "mt-2"}
      >
        {caption}
      </Eyebrow>
    </div>
  );
}
