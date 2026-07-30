import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";

/**
 * The rail's count/word pill.
 *
 * RULE: the tone is GIVEN, never derived. FAILURE PREVENTED: a badge that
 * colours itself from its own number is a state machine living in the
 * navigator, and §3 says the server owns every state machine. The export builds
 * door badges and flow badges from one factory that TAKES a tone
 * (`sbItem(k,label,badge,tone)`), so the second consumer must not fork.
 *
 * IT CARRIES A COUNT OF WHAT IS LEFT, NEVER A RATE (§4.5). A number here is
 * "three gaps open"; anything per-hour is refused at this component.
 */
/* eslint-disable-next-line react-refresh/only-export-components -- exported so the tone set is testable as a pure function in the node gate, the same reason Button exports buttonClasses. */
export const railBadgeClasses = cva(
  "ml-auto shrink-0 rounded-pill px-2 py-0.5 font-mono text-micro",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-ink-secondary",
        attend: "border border-state-attend-border bg-state-attend-surface text-state-attend-ink",
        halt: "border border-state-halt-border bg-state-halt-surface text-state-halt-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface RailBadgeProps {
  /** The row's path — the badge's testid rides the same namespace as its row. */
  to: string;
  tone?: "neutral" | "attend" | "halt";
  children: ReactNode;
}

export function RailBadge({ to, tone, children }: RailBadgeProps) {
  return (
    <span data-testid={`rail-badge-${to}`} className={cn(railBadgeClasses({ tone }))}>
      {children}
    </span>
  );
}
