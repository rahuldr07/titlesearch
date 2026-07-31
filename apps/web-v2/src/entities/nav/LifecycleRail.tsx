import { cn } from "../../shared/ui/classNames";
import { RailRow, type DoorAttention } from "./RailRow";
import { RailBadge, type RailBadgeTone } from "./RailBadge";
import { StageDot } from "./StageDot";

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
          <div key={stage.to} className="flex flex-col">
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

/**
 * The spine between two stages, drawn as the export draws it (`railBg`,
 * TitlePipe.dc.html:2934): green once the stage BEHIND it is done, so the rail
 * fills in behind you and reads as a line you have walked rather than six
 * unrelated rows.
 *
 * RULE: the segment's colour is the EARLIER stage's `done`, never this one's
 * and never "we are past it". FAILURE PREVENTED: a rail coloured from the
 * active row runs green all the way to wherever you happen to be standing —
 * progress claimed by navigation, which is exactly the progress nobody
 * recorded. Ahead of the current stage the line stays grey because the server
 * has not said otherwise.
 *
 * Named for the stage BELOW it (`rail-link-<path>`) so a test can ask "is the
 * line into Completeness filled?" without counting rows.
 */
function StageLink({
  to,
  collapsed,
  filled,
}: {
  to: string;
  collapsed: boolean;
  filled: boolean;
}) {
  return (
    <div className={cn("flex", collapsed ? "justify-center" : "px-4")}>
      <span
        aria-hidden
        data-testid={`rail-link-${to}`}
        data-done={filled ? "1" : "0"}
        className="flex size-6 items-center justify-center"
      >
        <span className={cn("h-3 w-px", filled ? "bg-state-settled" : "bg-line-strong")} />
      </span>
    </div>
  );
}
