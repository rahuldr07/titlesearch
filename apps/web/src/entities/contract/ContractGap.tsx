import type { ReactNode } from "react";
import { cx } from "../../components/ui";

/**
 * A THING THE DESIGN DRAWS AND THE CONTRACT CANNOT BACK, SAYING SO IN PLACE.
 *
 * `Unbuilt` (app/chrome) is the whole-screen version of this. It could not be
 * reused here because these screens are BUILT: most of the design's surface
 * binds to a real endpoint and a minority of it does not, and the minority has
 * to be visible inside the built screen rather than replacing it.
 *
 * The alternative — drawing the design's box with plausible contents — is what
 * root AGENTS.md forbids twice over: "never generate backend logic from the
 * UI/screens" and "never emit a value you can't cite". A docket excerpt with an
 * invented debtor name, or a SHA chip over a hash nothing returns, reads as
 * finished to everybody who opens it, and the person it misleads worst is the
 * backend owner deciding what still needs building.
 *
 * `needs` is the ASK, file:line into `packages/contract` where a neighbouring
 * shape exists. It is required: a gap that does not say what would close it is
 * a shrug.
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
