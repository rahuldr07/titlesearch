import type { OrderPipelineResponse } from "@titlepipe/contract";

/**
 * THE META STRIP — the design's cell bar under the heading.
 *
 * It is two cells wide, not the design's three: the first cell is the order
 * ref, and `OrderStrip` already prints that from `GET /api/orders/{id}/context`
 * at the top of every order-scoped screen. A second printing from a second
 * response is the second literal rule 11 forbids — the same value with two
 * chances to disagree.
 *
 * THE TWO FIGURES ARE PRINTED, NEVER SUBTRACTED. "53 pages carried nothing" is
 * arithmetic on server data, and a difference the client computes is a third
 * number nobody serves. `classifier_note` already says what the other pages
 * were, in the server's words, so it is a full-width row rather than a fourth
 * cell.
 *
 * `total_pages` is `z.number().int()` and cannot express "the package could not
 * be read" — packages/mocks records that gap at workspace.ts:667-673, where an
 * unreadable package arrives as `0`. The strip labels it as the server's count
 * and adds no meaning of its own on top.
 */
export function MetaStrip(props: { readonly pipeline: OrderPipelineResponse }) {
  return (
    <div
      data-testid="extraction-meta"
      className="overflow-hidden rounded-lg border border-line-strong bg-surface-panel"
    >
      <dl className="grid grid-cols-2">
        <Cell label="Source package" value={`${props.pipeline.total_pages} pages`} />
        <Cell label="Carried forward" value={`${props.pipeline.pages_relevant} pages`} />
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
