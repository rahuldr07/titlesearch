import type { Field } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/** The row's one status signal — a mark, not a capsule. Not `StatePill`. */
export type RowMarkProps = {
  readonly field: Field;
};

/**
 * The four settled renders. A record over `FieldState` minus the two
 * unsettled members, so a seventh state fails to compile here rather than
 * silently rendering nothing.
 */
const MARK: Readonly<
  Record<
    "auto_confirmed" | "confirmed" | "corrected" | "escalated",
    {
      mark: string;
      word: string;
      chrome: string;
    }
  >
> = {
  /** No human saw it. The resting tier — a ✓ you are not being asked to act on. */
  auto_confirmed: { mark: "✓", word: "auto", chrome: "text-state-settled-muted" },
  confirmed: { mark: "✓", word: "confirmed", chrome: "text-state-settled" },
  corrected: { mark: "✎", word: "corrected", chrome: "text-state-settled" },
  /** Stopped until a rule resolves it. Halt, not settled. */
  escalated: { mark: "↗", word: "escalated", chrome: "text-state-halt" },
};

export function RowMark({ field }: RowMarkProps) {
  if (field.state === "pending" || field.state === "needs_review") return null;

  const render = MARK[field.state];
  // The server said this field is an absence AND that a person settled it.
  const acceptedAbsence = field.na_reason !== null && field.state === "confirmed";

  return (
    <span
      data-testid="row-mark"
      data-field-state={field.state}
      className={cx(
        "flex items-center gap-2 whitespace-nowrap font-sans text-label leading-flat font-semibold",
        render.chrome,
      )}
    >
      <span aria-hidden className="font-mono">
        {render.mark}
      </span>
      {acceptedAbsence ? "accepted N/A" : render.word}
    </span>
  );
}
