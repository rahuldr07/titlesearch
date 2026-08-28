import type { OrderPipelineResponse } from "@titlepipe/contract";

/**
 * THE META STRIP — the design's three-cell bar under the heading
 * (`/tmp/ref.html` §isProcessing: a white 14px-radius box, one row of cells
 * divided by hairlines, each an 11px bold label over a 13px mono value).
 *
 * ══ RULE 11, AND WHY THE ORDER REF CELL IS NOT DRAWN ═══════════════════════
 *
 * The design's first cell is the order ref. It is NOT printed here, because
 * `OrderStrip` already prints it from `GET /api/orders/{id}/context`
 * (intake.ts:301) at the top of every order-scoped screen. Drawing it a second
 * time from a second response would be exactly the second literal rule 11
 * forbids — the same value with two chances to disagree. So the strip is two
 * cells wide rather than three, and the geometry is otherwise the design's.
 *
 * What IS here comes wholly from `OrderPipelineResponse` (intake.ts:92):
 *
 *   - `total_pages` — the package (the design's "Source package").
 *   - `pages_relevant` — what the classifier carried forward ("Volume").
 *   - `classifier_note` — the server's sentence about the rest.
 *
 * THE TWO FIGURES ARE PRINTED, NEVER SUBTRACTED. "53 pages carried nothing" is
 * arithmetic on server data, and a difference the client computes is a third
 * number nobody serves. The classifier's own note already says what the other
 * pages were, in the server's words — so the note is a full-width row under
 * the cells rather than a fourth cell, which is where a sentence belongs.
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

function Cell(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-2 border-r border-line-strong p-8 last:border-r-0">
      {/* The design's 11px bold caption. `ink-muted`, not `ink-faint`: the
          faint tier measures 3.17:1 at 11px and fails AA (tokens.css:106-119). */}
      <dt className="font-sans text-label font-bold leading-flat text-ink-muted">
        {props.label}
      </dt>
      {/* Rule 3: mono for data, at the design's 13px rather than the 20px this
          strip used to draw — the cell is a caption, not a verdict. */}
      <dd className="font-mono text-meta font-semibold leading-flat tabular-nums text-ink-primary">
        {props.value}
      </dd>
    </div>
  );
}
