import { useQuery } from "@tanstack/react-query";
import { OrderFieldsResponse } from "@titlepipe/contract";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { api } from "../../api";
import { FieldRow } from "../../entities/field/FieldRow";
import { DecisionPanel } from "./DecisionPanel";
import { PassOrder } from "./PassOrder";
import { QueueKeys } from "./QueueKeys";

/**
 * Review — the assembled report, field by field.
 *
 * Built so far: the field list with selection, the A/B reading comparison, the
 * three field decisions, pass-order, and the J/K keyboard path.
 *
 * STILL ABSENT, deliberately rather than stubbed: the document pane and
 * click-to-source, the bug channel, the report section grouping, the read-only
 * intake sign-off block, and finalize. The last two are gated on rulings Q5/Q6.
 *
 * Everything here renders server state verbatim. Nothing computes `state`,
 * nothing derives whether a field needs review, and nothing keys off a null
 * value except the NoValue hand-off.
 *
 * CONTRACT GAP: OrderFieldsResponse carries no queue count, so "N remaining"
 * is counted here from the server's own `state` values. That is list arithmetic
 * over data the server sent — not a re-derivation of state, and not a domain
 * count like #OF MTGS (which CONTEXT §7 forbids the UI from computing).
 * It should still move server-side so the two cannot drift; the server already
 * owns the queue ordering.
 */
export function ReviewScreen() {
  const { orderId } = useParams({ from: "/orders/$orderId/review" });
  const search = useSearch({ from: "/orders/$orderId/review" });
  const navigate = useNavigate();

  const fields = useQuery({
    queryKey: ["orders", orderId, "fields"],
    queryFn: () =>
      api(OrderFieldsResponse, `/api/orders/${orderId}/fields`),
  });

  if (fields.isPending) {
    return (
      <div data-testid="review-loading" className="p-8 text-sm text-ink-muted">
        Loading the assembled report…
      </div>
    );
  }

  if (fields.isError) {
    // Named, never a blank. A failure here is the reviewer's whole screen.
    return (
      <div
        data-testid="review-unavailable"
        className="m-8 max-w-prose rounded-lg border border-state-halt-border bg-state-halt-surface p-5"
      >
        <div className="font-semibold text-state-halt-ink">
          Report unavailable.
        </div>
        <div className="mt-1 text-sm text-ink-secondary">
          {fields.error.message}
        </div>
      </div>
    );
  }

  const all = fields.data.fields;
  // The queue is exactly what the server marked needs_review. The UI does not
  // add to it, reorder it, or infer membership from anything else.
  const queued = all.filter((f) => f.state === "needs_review");

  const selectedPath = search.field ?? queued[0]?.path ?? all[0]?.path;
  const selected = all.find((f) => f.path === selectedPath);

  const select = (path: string) => {
    void navigate({
      to: "/orders/$orderId/review",
      params: { orderId },
      search: { field: path },
      replace: true,
    });
  };

  /**
   * Move to the next field the SERVER has queued, after this one. Called only
   * when a decision was ACCEPTED — a refusal (a 409) leaves the reviewer on the
   * field they were refused on, so they can read the server's message against
   * the thing it refused.
   *
   * The queue is the server's. This walks it in the order it arrived; it does
   * not sort, re-rank, or skip.
   */
  const advance = () => {
    const here = queued.findIndex((f) => f.path === selectedPath);
    const next = queued[here + 1] ?? queued.find((f) => f.path !== selectedPath);
    if (next !== undefined) select(next.path);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-app">
      {/*
        Renders nothing — it owns the J/K listener. A component rather than a
        hook in this function because the loading and error branches above return
        early, and a conditionally-called hook is a bug waiting to happen.
      */}
      <QueueKeys queued={queued} selectedPath={selectedPath} onSelect={select} />
      <div className="flex flex-wrap items-baseline gap-3 border-b border-line-strong bg-surface-panel px-5 py-3">
        <span className="text-micro font-bold tracking-eyebrow text-page-ref uppercase">
          Assembled report
        </span>
        <span className="font-mono text-sm text-ink-secondary">{orderId}</span>
        <span className="ml-auto text-sm text-ink-secondary">
          {queued.length} remaining
        </span>
        <PassOrder orderId={orderId} />
      </div>

      {selected === undefined ? null : (
        <DecisionPanel
          field={selected}
          orderId={orderId}
          onSettled={advance}
        />
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {all.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            selected={f.path === selectedPath}
            onSelect={() => select(f.path)}
          />
        ))}
      </div>
    </div>
  );
}
