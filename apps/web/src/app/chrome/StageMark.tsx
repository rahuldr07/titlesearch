import type { StagePhase } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * The design's stage circle — 16px, filled by the stage's phase, drawn on the
 * rail's dark column and on the strip's white one.
 *
 * `ordinal` is POSITIONAL: the stage's place in the server's own `stages`
 * array, and nothing else. ANALYSIS-screens.md §3 — the design's "1–5" fuses
 * three separate state machines into a numbering the browser invented, and this
 * numeral is a list index rather than a state.
 */
type StageGround = "rail" | "strip";

const FILL: Readonly<Record<StageGround, Readonly<Record<StagePhase, string>>>> = {
  rail: {
    done: "bg-state-settled text-ink-on-action",
    // The design's accent fill wants white; --color-rail-accent is a light
    // lilac, so the ink inverts to keep the glyph legible.
    running: "bg-rail-accent text-rail-surface",
    halted: "bg-state-halt text-ink-on-action",
    waiting: "bg-rail-cap text-rail-ink-soft",
  },
  strip: {
    done: "bg-state-settled text-ink-on-action",
    running: "bg-action text-ink-on-action",
    halted: "bg-state-halt text-ink-on-action",
    waiting: "bg-line-strong text-ink-muted",
  },
};

/** Rule 7's closed vocabulary. A phase with no glyph shows its position. */
const GLYPH: Readonly<Partial<Record<StagePhase, string>>> = {
  done: "✓",
  halted: "•",
};

/** The phase in words — `waiting` and `running` differ only by fill otherwise. */
const PHASE_WORD: Readonly<Record<StagePhase, string>> = {
  done: "Done",
  running: "Running",
  halted: "Halted",
  waiting: "Waiting",
};

export function StageMark(props: {
  readonly phase: StagePhase;
  readonly ordinal: number;
  readonly ground: StageGround;
}) {
  return (
    <>
      <span
        aria-hidden
        data-slot="stage-mark"
        data-phase={props.phase}
        className={cx(
          "flex size-8 shrink-0 items-center justify-center rounded-pill",
          "font-mono text-label font-bold leading-flat tabular-nums",
          FILL[props.ground][props.phase],
        )}
      >
        {GLYPH[props.phase] ?? props.ordinal}
      </span>
      <span className="sr-only">{PHASE_WORD[props.phase]}</span>
    </>
  );
}
