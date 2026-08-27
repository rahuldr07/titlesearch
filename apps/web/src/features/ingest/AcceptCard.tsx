import { Link } from "@tanstack/react-router";
import type { Order } from "@titlepipe/contract";
import { Badge, Button } from "../../components/ui";

/**
 * ACT TWO — SIGNING FOR THE PACKAGE, AND THE SCREEN AFTERWARDS.
 *
 * INVARIANT 47 (`docs/INVARIANTS.md:131`): "Acceptance is explicit — an upload
 * alone never queues an order." The upload has already succeeded when this
 * renders; the order EXISTS and is not queued. That distinction is the whole
 * screen, so it is stated in words rather than implied by a button being
 * present.
 *
 * The design draws one "Sign" button covering both acts and
 * `ANALYSIS-screens.md` §7 conversation 3 records that as the blur. Two cards,
 * two acts, and nothing chains them.
 *
 * ══ RULE 1: THE ACCENT IS SPENT HERE ═══════════════════════════════════════
 *
 * "Accept — sign for it" is the single primary action of the intake screen,
 * which is why the upload button one stage earlier is a secondary. There is
 * exactly one accent-filled control visible at any moment on this route.
 *
 * ══ WHAT IS NOT PRINTED ════════════════════════════════════════════════════
 *
 * `order.pages` is null on a fresh ingest (entities.ts:60) and this card does
 * not print a page count, a duration, or an ETA. `INVARIANTS:84-85` bans pace
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

/** The record after the second act. The order is queued because the server said so. */
export function AcceptedCard(props: {
  readonly order: Order;
  readonly onAgain: () => void;
}) {
  return (
    <div
      data-testid="accepted-card"
      className="flex flex-col gap-6 rounded-lg border border-line-strong bg-surface-panel p-12 shadow-card"
    >
      {/* Rule 6: a coloured capsule at a moment of record, and this is one. */}
      <Badge tone="settled">✓ Signed for</Badge>

      <p className="font-sans text-subject font-semibold leading-tight text-ink-primary">
        Signed for. Order{" "}
        <span className="font-mono">{props.order.external_ref}</span> is queued.
      </p>

      <p className="font-sans text-meta leading-body text-ink-secondary">
        {props.order.county} Co., {props.order.state} — accepted and headed for
        the pipeline. The queue decides who sees it next; there is no way to
        pick it out of the queue by hand.
      </p>

      <div className="flex flex-wrap items-center gap-8">
        <Link
          to="/queue"
          className="font-sans text-meta font-semibold leading-close text-action underline underline-offset-4"
        >
          Review queue →
        </Link>
        <Button data-testid="ingest-again" onPress={props.onAgain}>
          Ingest another
        </Button>
      </div>
    </div>
  );
}
