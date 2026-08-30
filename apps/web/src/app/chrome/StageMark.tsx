import type { ReactNode } from "react";
import { cx } from "../../components/ui";

/**
 * The reference app's stage circle and stage badge — drawn on the rail's dark
 * column and on the order bar's white one.
 *
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`:
 * the reference draws a green ✓ on a DONE stage, the stage's number otherwise,
 * an accent fill on the CURRENT one, and a finished badge pill where the
 * server hangs one. `done` and the badge string arrive off the wire
 * (`OrderStageTab`); `ordinal` is POSITIONAL — the item's place in the
 * server's own list, never a state the browser computed.
 */
type StageGround = "rail" | "strip";

const CIRCLE: Readonly<
  Record<StageGround, { done: string; current: string; waiting: string }>
> = {
  rail: {
    done: "bg-state-settled text-ink-on-action",
    // The design's accent fill wants white; --color-rail-accent is a light
    // lilac, so the ink inverts to keep the glyph legible.
    current: "bg-rail-accent text-rail-surface",
    waiting: "bg-rail-cap text-rail-ink-soft",
  },
  strip: {
    done: "bg-state-settled text-ink-on-action",
    current: "bg-action text-ink-on-action",
    waiting: "bg-line-strong text-ink-muted",
  },
};

export function StageCircle(props: {
  readonly done: boolean;
  readonly current: boolean;
  readonly ordinal: number;
  readonly ground: StageGround;
}) {
  const fill = props.done
    ? CIRCLE[props.ground].done
    : props.current
      ? CIRCLE[props.ground].current
      : CIRCLE[props.ground].waiting;
  return (
    <>
      <span
        aria-hidden
        data-slot="stage-mark"
        data-done={props.done}
        className={cx(
          "flex size-8 shrink-0 items-center justify-center rounded-pill",
          "font-mono text-label font-bold leading-flat tabular-nums",
          fill,
        )}
      >
        {props.done ? "✓" : props.ordinal}
      </span>
      <span className="sr-only">{props.done ? "Done" : "Not done"}</span>
    </>
  );
}

/**
 * The stage's badge pill — the SERVED string, whole ("6", "ready", "2nd
 * read"). The reference paints "ready" green and workload amber; `tone` is
 * the server's word for which (`OrderStageTab.badge_tone`).
 */
export function StageBadge(props: {
  readonly tone: "attend" | "settled";
  readonly children: ReactNode;
}) {
  return (
    <span
      data-slot="stage-badge"
      data-tone={props.tone}
      className={cx(
        "ml-auto shrink-0 rounded-pill px-4 py-1 font-mono text-label font-bold leading-flat tabular-nums",
        props.tone === "settled"
          ? "bg-state-settled text-ink-on-action"
          : "bg-state-attend-surface text-state-attend",
      )}
    >
      {props.children}
    </span>
  );
}
