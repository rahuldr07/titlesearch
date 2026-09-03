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
  /* The design gives this track 24px and puts ONE GLYPH in it. The word was
     rendered beside the mark and clipped on every settled row — measured
     "✓ confirmed" at scrollWidth 66 in a 24px cell. It survives as the
     accessible name and the hover title. */
  const word = acceptedAbsence ? "accepted N/A" : render.word;

  return (
    <span
      data-testid="row-mark"
      data-field-state={field.state}
      title={word}
      className={cx(
        "flex items-center justify-end font-mono text-body leading-flat font-bold",
        render.chrome,
      )}
    >
      <span aria-hidden>{render.mark}</span>
      <span className="sr-only">{word}</span>
    </span>
  );
}
