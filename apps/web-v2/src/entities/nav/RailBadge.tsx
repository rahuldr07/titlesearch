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
  "ml-auto inline-flex h-8.5 min-w-8.5 shrink-0 items-center justify-center rounded-pill px-2.5 font-mono text-tiny font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-ink-secondary",
        attend:
          "border border-state-attend-border bg-state-attend-surface text-state-attend-ink",
        /*
         * SOLID, where attend is a tint. The mockup draws the two rail badges
         * as a filled red pill and an outlined amber one, and the difference is
         * doing work: at 17px a tint and a tint are one shape, and the whole
         * claim of the badge is that six-open and three-unresolved are not the
         * same news. Fill-vs-outline survives greyscale; two hues do not.
         * `ink-on-action` on `state-halt` is gated in contrast.test.ts.
         */
        halt: "bg-state-halt text-ink-on-action",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/**
 * Named so the tone can travel with a stage from the chrome that decided it
 * (`app/orderLifecycle.ts`) to the pill that wears it, without either end
 * writing the union out again and the two drifting into different sets.
 */
export type RailBadgeTone = "neutral" | "attend" | "halt";

export interface RailBadgeProps {
  /** The row's path — the badge's testid rides the same namespace as its row. */
  to: string;
  tone?: RailBadgeTone;
  children: ReactNode;
}

export function RailBadge({ to, tone, children }: RailBadgeProps) {
  return (
    <span data-testid={`rail-badge-${to}`} className={cn(railBadgeClasses({ tone }))}>
      {children}
    </span>
  );
}
