import type { OrderPipelineResponse } from "@titlepipe/contract";

/**
 * The meta strip. The ref cell quotes the same `order_ref` the context read
 * serves — one variable, passed down, never a second literal. `package_name`
 * and `volume_label` are server-composed strings; null is the server having no
 * package to name, printed as that. `classifier_note` is the server's own
 * sentence about what the other pages were.
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

/** `ink-muted`, not `ink-faint`: the faint tier fails AA at this size. */
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
