import { cn } from "../../shared/ui/classNames";
import { RailRow, type DoorAttention } from "./RailRow";
import { RailBadge } from "./RailBadge";

/**
 * The lifecycle "flow" rail — the order's pipeline stages as a NUMBERED
 * VERTICAL RAIL, grouped under the header `flowSectionLabel` chooses.
 *
 * READS SHAPE ONLY. `n` (position), `done` (checkmark), `active` and `badge`
 * all arrive as props. RULE: this component never derives stage state — not
 * from confidence, not from counts, not from `value === null`. FAILURE
 * PREVENTED: a rail that disagrees with the pipeline about where an order is.
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
      {stages.map((stage, i) => (
        <div key={stage.to} className="flex flex-col">
          {i === 0 ? null : (
            <div className={cn("flex", collapsed ? "justify-center" : "px-4")}>
              <span aria-hidden className="flex size-6 items-center justify-center">
                <span className="h-3 w-px bg-line-strong" />
              </span>
            </div>
          )}
          <RailRow
            to={stage.to}
            label={stage.label}
            active={stage.active}
            collapsed={collapsed}
            attention={stage.attention}
            onNavigate={onNavigate}
            marker={<StageDot n={stage.n} done={stage.done} />}
            {...(stage.badge === null
              ? {}
              : { badge: <RailBadge to={stage.to}>{stage.badge}</RailBadge> })}
            {...(stage.reachable === false ? { reachable: false } : {})}
          />
        </div>
      ))}
    </nav>
  );
}

/**
 * The stage's mark: its number, or a checkmark once the server says done.
 * A DONE STAGE IS THE SERVER'S CLAIM, never "you already walked past this
 * screen" — progress nobody recorded is progress that is not real.
 */
function StageDot({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-pill border font-mono text-micro",
        done
          ? "border-state-settled-border bg-state-settled-surface text-state-settled-ink"
          : "border-line-strong text-ink-secondary",
      )}
    >
      {done ? "✓" : n}
    </span>
  );
}
