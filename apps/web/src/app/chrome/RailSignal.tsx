import type { ReactNode } from "react";
import { cx } from "../../components/ui";

/**
 * The signals that ride a rail door.
 *
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`:
 * "counts on rail doors, stage badges … are drawn, so they are built." The
 * attention DOT this file used to carry (INVARIANT 66's replacement for a
 * count) is superseded for every door the reference app badges: All Orders
 * carries its served total, QC & Escalations its served "1 QC" pill, and
 * Templates Architect its served version. Every string here arrives FINISHED
 * off `GET /api/rail` — nothing on the rail is counted, captioned or
 * formatted in the browser.
 */
export type RailBadgeTone = "count" | "accent" | "attend";

const TONE: Readonly<Record<RailBadgeTone, string>> = {
  /** The reference's white-on-translucent count capsule (All Orders). */
  count: "bg-rail-cap text-surface-panel",
  /** The reference's lilac version pill (Templates Architect "v4.2"). */
  accent: "bg-rail-cap text-rail-accent",
  /** The reference's amber workload badge ("1 QC", the Examination count). */
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
        "ml-auto shrink-0 rounded-pill px-4 py-1 font-mono text-label font-semibold leading-flat tabular-nums",
        TONE[props.tone],
      )}
    >
      {props.children}
    </span>
  );
}
