import type { OrderPipelineResponse } from "@titlepipe/contract";

/**
 * THE META STRIP (design §Screens 6: "meta strip — ref / package / volume").
 *
 * ══ RULE 11, AND WHY THE REF IS NOT HERE ═══════════════════════════════════
 *
 * The design's first cell is the order ref. It is NOT printed here, because
 * `OrderStrip` already prints it from `GET /api/orders/{id}/context`
 * (intake.ts:301) at the top of every order-scoped screen. Drawing it a second
 * time from a second response would be exactly the second literal rule 11
 * forbids — the same value with two chances to disagree.
 *
 * What IS here comes wholly from `OrderPipelineResponse` (intake.ts:92), which
 * is the same response the hub reads:
 *
 *   - `total_pages` — the package.
 *   - `pages_relevant` — the volume the classifier carried forward.
 *   - `classifier_note` — the server's sentence about the rest.
 *
 * THE TWO FIGURES ARE PRINTED, NEVER SUBTRACTED. "53 pages carried nothing" is
 * arithmetic on server data, and a difference the client computes is a third
 * number nobody serves. The classifier's own note already says what the other
 * pages were, in the server's words.
 *
 * `total_pages` is `z.number().int()` and cannot express "the package could not
 * be read" — packages/mocks records that gap at workspace.ts:667-673, where an
 * unreadable package arrives as `0`. So the strip labels it as the server's
 * count and does not add a meaning of its own on top.
 */
export function MetaStrip(props: { readonly pipeline: OrderPipelineResponse }) {
  return (
    <div
      data-testid="extraction-meta"
      className="flex flex-col gap-5 rounded-md border border-line-strong bg-surface-sunken px-8 py-6"
    >
      <dl className="flex flex-wrap gap-12">
        <Cell label="Package" value={`${props.pipeline.total_pages} pages`} />
        <Cell
          label="Carried forward"
          value={`${props.pipeline.pages_relevant} pages`}
        />
      </dl>
      <p
        data-testid="classifier-note"
        className="font-sans text-meta leading-body text-ink-secondary"
      >
        {props.pipeline.classifier_note}
      </p>
    </div>
  );
}

function Cell(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-label font-semibold uppercase tracking-caps leading-flat text-ink-faint">
        {props.label}
      </dt>
      {/* Rule 3: mono for data. Rule 2: `text-subject` is one of the six. */}
      <dd className="font-mono text-subject leading-flat tabular-nums text-ink-primary">
        {props.value}
      </dd>
    </div>
  );
}
