import type { FieldState } from "@titlepipe/contract";

/**
 * The field's lifecycle state, rendered VERBATIM from the server.
 *
 * This component is deliberately dumb. It does not look at
 * `engine_confidence_raw`, at `value`, or at anything else — the server owns
 * every transition and every threshold (CONTEXT §7). A 0.99-confidence field
 * the server says needs review stays needing review; a 0.01-confidence
 * auto-confirm stays auto-confirmed.
 *
 * The label map is exhaustive with a `never` guard for the same reason NoValue
 * is: a new state in the contract must be given a render, not silently fall
 * through to a blank pill.
 */

interface PillSpec {
  readonly label: string;
  readonly className: string;
}

function spec(state: FieldState): PillSpec {
  switch (state) {
    case "pending":
      // the pipeline has not reached it — quiet, and NOT a review prompt
      return {
        label: "PENDING",
        className: "border-line-strong text-ink-muted",
      };
    case "auto_confirmed":
      return {
        label: "AUTO-CONFIRMED",
        className:
          "border-state-settled-border bg-state-settled-surface text-state-settled",
      };
    case "needs_review":
      return {
        label: "NEEDS REVIEW",
        className:
          "border-state-attend-border bg-state-attend-surface text-state-attend",
      };
    case "confirmed":
      return {
        label: "CONFIRMED",
        className:
          "border-state-settled-border bg-state-settled-surface text-state-settled",
      };
    case "corrected":
      return {
        label: "CORRECTED",
        className:
          "border-page-ref-border bg-page-ref-surface text-page-ref",
      };
    case "escalated":
      return {
        label: "ESCALATED",
        className:
          "border-state-attend-border bg-state-attend-surface text-state-attend",
      };
    default: {
      const unhandled: never = state;
      throw new Error(
        `unhandled field state: ${JSON.stringify(unhandled)} — every server state needs its own pill`,
      );
    }
  }
}

export function StatePill({
  state,
  testId,
}: {
  state: FieldState;
  testId?: string;
}) {
  const s = spec(state);
  return (
    <span
      {...(testId === undefined ? {} : { "data-testid": testId })}
      className={`inline-block rounded-xs border px-2 py-px text-micro font-bold tracking-badge uppercase ${s.className}`}
    >
      {s.label}
    </span>
  );
}
