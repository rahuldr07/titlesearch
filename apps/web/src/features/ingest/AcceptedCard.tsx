import type { Order } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { RouteButton } from "../../app/chrome/RouteButton";

/**
 * THE SEALED CARD — the reference's "Package Ingested & Signature Sealed",
 * drawn after the one signed act (RULING-2026-08-29). The order is queued
 * because the SERVER acknowledged both halves of the act; nothing here is
 * optimistic. The page figure is `Order.pages`, the server's own count off
 * the optical pass — absent, the sentence simply omits it rather than
 * asserting somebody counted.
 */
export function AcceptedCard(props: {
  readonly order: Order;
  readonly onAgain: () => void;
}) {
  return (
    <div
      data-testid="accepted-card"
      className="flex flex-col items-center gap-6 rounded-lg border border-line-strong bg-surface-panel p-16 text-center shadow-card"
    >
      <span
        aria-hidden
        className="flex size-24 items-center justify-center rounded-pill bg-state-settled-surface font-sans text-title font-bold text-state-settled"
      >
        ✓
      </span>

      <h2 className="font-sans text-title font-bold leading-tight text-ink-primary">
        Package Ingested &amp; Signature Sealed
      </h2>

      <p className="font-sans text-meta leading-body text-ink-muted">
        Order <span className="font-mono">{props.order.external_ref}</span> is
        signed for and queued.{" "}
        {props.order.pages === null
          ? "Dual-engine extraction begins from here."
          : `Dual-engine extraction pipeline is actively processing ${String(props.order.pages)} scanned pages.`}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-8">
        <RouteButton
          variant="primary"
          to="/orders/$orderId"
          params={{ orderId: props.order.id }}
        >
          View Live Dual-Engine Extraction →
        </RouteButton>
        <Button data-testid="ingest-again" onPress={props.onAgain}>
          Ingest another
        </Button>
      </div>
    </div>
  );
}
