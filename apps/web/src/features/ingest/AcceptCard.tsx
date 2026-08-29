import type { Order } from "@titlepipe/contract";
import { Button } from "../../components/ui";

/**
 * ACT TWO — SIGNING FOR THE PACKAGE.
 *
 * INVARIANT 47 (`docs/INVARIANTS.md:131`): "Acceptance is explicit — an upload
 * alone never queues an order." The upload has already succeeded when this
 * renders; the order EXISTS and is not queued. That distinction is the whole
 * card, so it is stated in words rather than implied by a button being present.
 * The design draws one "Sign" button covering both acts and
 * `ANALYSIS-screens.md` §7 conversation 3 records that as the blur.
 *
 * RULE 1: THE ACCENT IS SPENT HERE. "Accept — sign for it" is the single
 * primary action of the intake screen, which is why the upload button one stage
 * earlier is a secondary.
 *
 * `order.pages` is null on a fresh ingest (entities.ts:60) and this card prints
 * no page count, no duration and no ETA — `INVARIANTS:84-85` bans pace
 * indicators and estimates outright, and there is no field to bind one to.
 */
export function AcceptCard(props: {
  readonly order: Order;
  readonly fileName: string;
  readonly pending: boolean;
  readonly onAccept: () => void;
}) {
  return (
    <div
      data-testid="accept-card"
      className="flex flex-col gap-6 rounded-lg border border-line-strong bg-surface-panel p-12 shadow-card"
    >
      <div className="flex flex-wrap items-baseline gap-6">
        <span className="font-mono text-subject font-semibold leading-flat text-ink-primary">
          {props.order.external_ref}
        </span>
        <span className="font-sans text-meta leading-close text-ink-secondary">
          {props.order.county} Co., {props.order.state}
        </span>
        <span className="font-mono text-label leading-flat text-ink-muted">
          {props.fileName}
        </span>
      </div>

      <p className="font-sans text-body leading-body text-ink-primary">
        Uploaded, and on the dock. It is not queued: nothing reaches a reviewer
        until a named person signs for it.
      </p>

      <div className="flex flex-wrap items-center gap-6">
        <Button
          variant="primary"
          data-testid="accept-btn"
          onPress={props.onAccept}
          disabledBecause={
            props.pending ? "Signing for the package…" : undefined
          }
        >
          Accept — sign for it
        </Button>
        <span className="font-sans text-label leading-close text-ink-muted">
          Your name goes on the record with the signature.
        </span>
      </div>
    </div>
  );
}
