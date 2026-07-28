import type { StageKind } from "@titlepipe/contract";

/**
 * Colour per stage KIND, never per stage.
 *
 * Seven stages, four colours — because the reader is not being asked to learn
 * seven hues, they are being asked one question per column: is this moving, or
 * is it stopped on somebody? Violet answers "a person holds this", and it is
 * the same violet the rest of the product uses for "yours to act on", so the
 * meaning is already learned by the time anyone reaches this board.
 *
 * `idle` and `machine` deliberately share the grey bar: neither is anybody's
 * problem yet. They differ in the count's ink, which is enough — an unassigned
 * order is not a defect and should not be coloured like one.
 *
 * A count of zero always reads muted regardless of kind, so an empty violet
 * column does not shout about work that does not exist.
 */
export interface StageTone {
  /** the 3px cap across the top of a board column / the rail's spine */
  readonly bar: string;
  /** the count's ink when the stage is occupied */
  readonly count: string;
  /** the rail's order pills */
  readonly chip: string;
}

export const STAGE_TONE: Record<StageKind, StageTone> = {
  idle: {
    bar: "bg-line-strong",
    count: "text-ink-muted",
    chip: "border-line-strong bg-surface-app",
  },
  halt: {
    bar: "bg-action",
    count: "text-action",
    chip: "border-action-border bg-action-surface",
  },
  machine: {
    bar: "bg-line-strong",
    count: "text-ink-secondary",
    chip: "border-line-strong bg-surface-panel",
  },
  done: {
    bar: "bg-state-settled",
    count: "text-state-settled",
    chip: "border-state-settled-border bg-state-settled-surface",
  },
};

/** The ink for a stage's count — muted when the stage is empty. */
export function countInk(kind: StageKind, count: number): string {
  return count === 0 ? "text-ink-muted" : STAGE_TONE[kind].count;
}
