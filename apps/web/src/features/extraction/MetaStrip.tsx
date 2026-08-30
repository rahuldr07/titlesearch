import type { OrderPipelineResponse } from "@titlepipe/contract";

/**
 * THE META STRIP — the reference's three cells, as drawn: Order ref · Source
 * package · Volume. ⚠ RULED 2026-08-29
 * (`docs/frontend/design-2026-08/RULING-2026-08-29.md`): the strip was held to
 * two cells so the order ref would print once; the ruling builds the drawn
 * three, and the ref cell quotes the SAME `order_ref` the strip above reads
 * (`GET /api/orders/{id}/context`) — one variable, passed down, never a second
 * literal.
 *
 * `package_name` and `volume_label` are SERVER-COMPOSED strings on the
 * pipeline response (intake.ts, same ruling). Null is the server having no
 * package to name, printed as that. `classifier_note` stays the full-width
 * row: it is the server's own sentence about what the other pages were.
 */
export function MetaStrip(props: {
  readonly pipeline: OrderPipelineResponse;
  /** From `/context` — the one order-ref read every order screen shares. */
  readonly orderRef: string | null;
}) {
  return (
    <div
      data-testid="extraction-meta"
      className="overflow-hidden rounded-lg border border-line-strong bg-surface-panel"
    >
      <dl className="grid grid-cols-3">
        <Cell label="Order ref" value={props.orderRef ?? "Not served"} />
        <Cell
          label="Source package"
          value={props.pipeline.package_name ?? "No package named"}
        />
        <Cell
          label="Volume"
          value={props.pipeline.volume_label ?? "No count — the package could not be read"}
        />
      </dl>
      <p
        data-testid="classifier-note"
        className="border-t border-line-strong px-8 py-6 font-sans text-meta leading-body text-ink-secondary"
      >
        {props.pipeline.classifier_note}
      </p>
    </div>
  );
}

/** `ink-muted`, not the design's `ink-faint`: the faint tier measures 3.17:1 at
    11px and fails AA (tokens.css:106-119). Rule 3 puts the value in mono. */
function Cell(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-2 border-r border-line-strong p-8 last:border-r-0">
      <dt className="font-sans text-label font-bold leading-flat text-ink-muted">
        {props.label}
      </dt>
      <dd className="font-mono text-meta font-semibold leading-flat tabular-nums text-ink-primary">
        {props.value}
      </dd>
    </div>
  );
}
