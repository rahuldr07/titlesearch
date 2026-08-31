import type { ReactNode } from "react";
import { cx } from "../../components/ui";

/**
 * A thing the design draws and the contract cannot back, saying so in place.
 * Never drawn with plausible invented contents — a box that reads as
 * finished misleads exactly the person deciding what still needs building.
 * `needs` is required: a gap that does not say what would close it is a
 * shrug. `Unbuilt` (app/chrome) is the whole-screen version.
 */
export function ContractGap(props: {
  /** What the design calls this, verbatim, so the two can be matched up. */
  readonly drawn: string;
  /** What the contract has instead — usually "nothing". */
  readonly has: ReactNode;
  /** What would close it, cited. */
  readonly needs: ReactNode;
}) {
  return (
    <section
      data-testid="contract-gap"
      data-gap={props.drawn}
      className={cx(
        "flex flex-col gap-5 rounded-md border border-dashed border-state-attend-border",
        "bg-state-attend-surface px-10 py-8",
      )}
    >
      <span className="font-sans text-label leading-flat font-bold text-state-attend">
        Not built — no contract surface
      </span>
      <p className="font-sans text-meta leading-close font-semibold text-ink-primary">
        {props.drawn}
      </p>
      <p className="font-sans text-meta leading-body text-ink-secondary">{props.has}</p>
      <p className="font-sans text-meta leading-body text-ink-secondary">{props.needs}</p>
    </section>
  );
}
