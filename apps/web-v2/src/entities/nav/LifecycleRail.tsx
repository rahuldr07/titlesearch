import { RailRow, type DoorAttention } from "./RailRow";
import { RailBadge, type RailBadgeTone } from "./RailBadge";
import { StageDot } from "./StageDot";
import { StageLink } from "./StageLink";

/**
 * The lifecycle "flow" rail — the order's pipeline stages as a NUMBERED
 * VERTICAL RAIL, grouped under the header `flowSectionLabel` chooses.
 *
 * READS SHAPE ONLY. `n` (position), `done` (checkmark), `active`, `badge` and
 * its tone all arrive as props. RULE: this component never derives stage state
 * — not from confidence, not from counts, not from `value === null`, and not
 * from "you already walked past this screen". FAILURE PREVENTED: a rail that
 * disagrees with the pipeline about where an order is.
 *
 * `n` IS STRUCTURAL — a fixed position in a fixed flow, drawn even with no
 * active order; `entities/nav/flow.ts` owns the sequence that makes that true.
 * `done` and `badge` are ORDER data, and `AppChrome` sets both to `false`/`null`
 * off an order screen rather than fabricate progress for an order nobody is
 * looking at.
 */
export interface LifecycleStage {
  to: string;
  label: string;
  active: boolean;
  attention: DoorAttention;
  /** Fixed position in the flow, 1-based. Always shown — not order data. */
  n: number;
  /** Checkmark. Server-cited (`PipelineStage.phase === "done"`) or `false`. */
  done: boolean;
  /** Per-stage count/word from the server, or `null` when none applies. */
  badge: string | null;
  /** GIVEN with the badge, never read off its number (`RailBadge`, §3). */
  badgeTone?: RailBadgeTone;
  /** `false` when the stage has no route yet — Review with no order in view. */
  reachable?: boolean;
}

export interface LifecycleRailProps {
  stages: readonly LifecycleStage[];
  collapsed: boolean;
  onNavigate: (to: string) => void;
}

export function LifecycleRail({ stages, collapsed, onNavigate }: LifecycleRailProps) {
  if (stages.length === 0) return null;
  return (
    <nav aria-label="Order lifecycle" data-testid="lifecycle-rail" className="flex flex-col">
      {stages.map((stage, i) => {
        // The stage BEHIND this one owns the segment above it — see `StageLink`.
        const behind = stages[i - 1];
        return (
          /*
           * `relative` so the segment can be positioned against THIS ROW rather
           * than laid out between two of them. That is the whole fix: the
           * connector used to be an 8px box in the flow between rows, which left
           * the 10px above and below each 20px disc unlined and drew the six
           * stages as six ticks with dashes floating between them. Absolutely
           * positioned, one segment spans its row's full height and meets the
           * next one exactly, so the column reads as ONE line — which is the
           * only thing that makes a done step read as "behind you".
           */
          <div key={stage.to} className="relative flex flex-col">
            {behind === undefined ? null : (
              <StageLink to={stage.to} collapsed={collapsed} filled={behind.done} />
            )}
            <RailRow
              to={stage.to}
              label={stage.label}
              active={stage.active}
              collapsed={collapsed}
              attention={stage.attention}
              onNavigate={onNavigate}
              marker={<StageDot n={stage.n} done={stage.done} active={stage.active} />}
              {...(stage.badge === null
                ? {}
                : {
                    badge: (
                      <RailBadge to={stage.to} tone={stage.badgeTone ?? "neutral"}>
                        {stage.badge}
                      </RailBadge>
                    ),
                  })}
              {...(stage.reachable === false ? { reachable: false } : {})}
            />
          </div>
        );
      })}
    </nav>
  );
}
