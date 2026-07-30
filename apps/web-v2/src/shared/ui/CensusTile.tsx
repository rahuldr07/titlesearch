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
 * TONE IS STATE, NOT EMPHASIS. Violet means "stopped on a person", which is the
 * product working correctly — most of the pipeline is meant to be waiting on
 * somebody, and drawing that as an alarm teaches a reviewer to read normal
 * operation as failure. Halt is kept for the figure where the order is in no
 * stage at all and nothing will move it.
 *
 * An UNTONED tile is the loudest ink, not the quietest: on a census tile the
 * figure is the content. `tone="muted"` is therefore a real choice — the
 * deliberately receded figure (a retired count, a no-source count that must not
 * out-shout the actionable one) — and not the absence of one.
 *
 * MONO NUMERALS, because these get compared against the package a person is
 * holding, and because a 1 beside a 7 stops lining up the moment a figure
 * changes width.
 */
const NUMERAL_TONE = {
  muted: "text-ink-muted",
  action: "text-action",
  attend: "text-state-attend-ink",
  halt: "text-state-halt-ink",
  settled: "text-state-settled-ink",
} as const;

/**
 * Both tiers come from the export: 22px where the tile IS the content of a
 * board, 15px where it rides along in the chrome strip. One component, because
 * a size is not a different claim — and the strip carries no padding of its own
 * because the chrome sets its own rhythm around it.
 */
const NUMERAL_SIZE = {
  strip: "text-census",
  board: "text-3xl",
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
    <div
      className={cn(
        size === "board" && "flex-1 basis-75 px-8 py-6",
        edge && "border-r border-line-subtle",
      )}
    >
      <p
        className={cn(
          "font-mono leading-flat font-semibold",
          NUMERAL_SIZE[size],
          tone ? NUMERAL_TONE[tone] : "text-ink-primary",
        )}
      >
        {value}
      </p>
      <Eyebrow variant="stat" as="p" className="mt-2">
        {caption}
      </Eyebrow>
    </div>
  );
}
