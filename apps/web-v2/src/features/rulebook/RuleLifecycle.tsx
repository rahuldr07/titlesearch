import type { RuleStatus } from "@titlepipe/contract";
import { cn } from "../../shared/ui/classNames";
import { LIFECYCLE, statusLabel } from "./ruleStatus";

const FILLED: Record<RuleStatus, string> = {
  pending: "bg-state-attend text-ink-on-action",
  live: "bg-state-settled text-ink-on-action",
  retired: "bg-ink-primary text-ink-on-action",
};

/**
 * PENDING → LIVE → RETIRED, always all three, always in that order.
 *
 * This is the screen's answer to "what happens next", and it is drawn even for
 * a retired rule because the path is the same for every rule in the book. The
 * stage a rule has NOT reached is as informative as the one it has: a reader
 * looking at a pending rule can see that LIVE is a step someone still has to
 * take, which a lone "PENDING" chip does not convey.
 *
 * The current stage is filled from the server's `status`. Nothing here computes
 * a state — a client-side state machine over rule lifecycle is exactly what
 * hard constraint 9 forbids, and it would be the client deciding whether a rule
 * applies.
 */
export function RuleLifecycle({ status }: { status: RuleStatus }) {
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-3 font-mono text-micro">
      {LIFECYCLE.map((stage, index) => (
        <li key={stage} className="flex items-center gap-3">
          {index === 0 ? null : (
            <span aria-hidden className="text-ink-muted">
              →
            </span>
          )}
          <span
            aria-current={stage === status}
            className={cn(
              "rounded-4 px-5 py-2 tracking-badge",
              stage === status ? FILLED[stage] : "bg-surface-app text-ink-muted",
            )}
          >
            {statusLabel(stage)}
          </span>
        </li>
      ))}
    </ol>
  );
}
