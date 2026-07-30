import type { MouseEvent } from "react";
import { cn } from "../../shared/ui/classNames";
import type { DoorAttention } from "./SidebarDoor";

/**
 * The lifecycle "flow" rail — the order's pipeline stages as a NUMBERED
 * VERTICAL RAIL (Task 12), grouped under the "THIS ORDER" header.
 *
 * READS SHAPE ONLY. `n` (position), `done` (checkmark), `active` (current
 * screen) and `badge` all arrive as props from the smart chrome. This
 * component NEVER derives stage state — not from confidence, not from counts,
 * not from `value === null`. The server owns every state machine (rule §3);
 * the rail only draws the sequence and marks where you are standing in it.
 *
 * `n` IS STRUCTURAL — a fixed position in a fixed flow, drawn even with no
 * active order. `done` and `badge` are ORDER data: `AppChrome` sets both to
 * `false`/`null` off an order screen rather than fabricate progress for an
 * order nobody is looking at (§3, `home.spec` "no fabrication" family).
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
          <StageRow stage={stage} collapsed={collapsed} onNavigate={onNavigate} />
        </div>
      ))}
    </nav>
  );
}

function StageRow({
  stage,
  collapsed,
  onNavigate,
}: {
  stage: LifecycleStage;
  collapsed: boolean;
  onNavigate: (to: string) => void;
}) {
  const { to, label, active, attention, n, done, badge } = stage;
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(to);
  };
  return (
    <a
      href={to}
      data-testid={`rail-door-${to}`}
      data-active={active ? "1" : "0"}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 rounded-3 text-xs font-medium no-underline",
        collapsed ? "h-22 justify-center px-0" : "h-20 px-4",
        active ? "bg-surface-raised text-ink-primary" : "text-ink-secondary",
      )}
    >
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
      {collapsed ? null : (
        <>
          <span className="truncate capitalize">{label}</span>
          {badge === null ? null : (
            <span
              data-testid={`rail-badge-${to}`}
              className="ml-auto shrink-0 rounded-pill bg-surface-sunken px-2 py-0.5 font-mono text-micro text-ink-secondary"
            >
              {badge}
            </span>
          )}
        </>
      )}
      {attention === null ? null : (
        <span
          data-testid={`rail-dot-${to}`}
          aria-label={attention === "halt" ? `${label}: unresolved` : `${label}: open`}
          className={cn(
            "size-2 shrink-0 rounded-pill",
            collapsed ? "absolute right-2 top-2" : "ml-auto",
            attention === "halt" ? "animate-tp-pulse bg-state-halt" : "bg-state-attend",
          )}
        />
      )}
    </a>
  );
}
