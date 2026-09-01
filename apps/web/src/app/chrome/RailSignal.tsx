import type { ReactNode } from "react";
import { cx } from "../../components/ui";

/**
 * The signals that ride a rail door. Every string arrives finished off
 * `GET /api/rail` — nothing on the rail is counted, captioned or formatted
 * in the browser.
 */
export type RailBadgeTone = "count" | "accent" | "attend";

const TONE: Readonly<Record<RailBadgeTone, string>> = {
  /** White-on-translucent count capsule (All Orders). */
  count: "bg-rail-cap text-surface-panel",
  /** Lilac version pill (Templates Architect). */
  accent: "bg-rail-cap text-rail-accent",
  /** Amber workload badge ("1 QC"). */
  attend: "bg-state-attend-surface text-state-attend",
};

export function RailBadge(props: {
  readonly path: string;
  readonly tone: RailBadgeTone;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <span
      data-testid={`rail-badge-${props.path}`}
      title={props.title}
      className={cx(
        "ml-auto shrink-0 rounded-pill px-3 py-1 font-mono text-label font-semibold leading-flat tabular-nums",
        TONE[props.tone],
      )}
    >
      {props.children}
    </span>
  );
}
