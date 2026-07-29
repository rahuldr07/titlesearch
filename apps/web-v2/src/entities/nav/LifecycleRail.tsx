import { SidebarDoor, type DoorAttention } from "./SidebarDoor";

/**
 * The lifecycle "flow" rail — the order's pipeline stages as a compact vertical
 * flow (§11: grouped doors PLUS a lifecycle flow rail).
 *
 * READS SHAPE ONLY. The stages, their order, whether one is the current screen,
 * and any attention dot all arrive as props from the smart chrome. This
 * component NEVER derives stage state — not from confidence, not from counts,
 * not from `value === null`. The server owns every state machine (rule §3); the
 * rail only draws the sequence and marks where you are standing in it.
 */
export interface LifecycleStage {
  to: string;
  label: string;
  active: boolean;
  attention: DoorAttention;
}

export interface LifecycleRailProps {
  stages: readonly LifecycleStage[];
  collapsed: boolean;
  onNavigate: (to: string) => void;
}

export function LifecycleRail({ stages, collapsed, onNavigate }: LifecycleRailProps) {
  if (stages.length === 0) return null;
  return (
    <nav
      aria-label="Order lifecycle"
      data-testid="lifecycle-rail"
      className="flex flex-col gap-1"
    >
      {stages.map((stage) => (
        <SidebarDoor
          key={stage.to}
          to={stage.to}
          label={stage.label}
          collapsed={collapsed}
          active={stage.active}
          attention={stage.attention}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
