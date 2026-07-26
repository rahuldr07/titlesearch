import { useQuery } from "@tanstack/react-query";
import { OrderFieldsResponse } from "@titlepipe/contract";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { api } from "../../api";
import { FieldRow, fieldLabel } from "../../entities/field/FieldRow";
import { StatePill } from "../../entities/field/StatePill";

/**
 * Review — the assembled report, field by field.
 *
 * PASS 3 INCREMENT 2. This is the field list and its selection ONLY. The
 * document pane, the decision actions (confirm / correct / escalate / bug), the
 * A-vs-B reading comparison, and the order rail are separate increments and are
 * deliberately absent rather than stubbed.
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-app">
      <div className="flex flex-wrap items-baseline gap-3 border-b border-line-strong bg-surface-panel px-5 py-3">
        <span className="text-micro font-bold tracking-eyebrow text-page-ref uppercase">
          Assembled report
        </span>
        <span className="font-mono text-sm text-ink-secondary">{orderId}</span>
        <span className="ml-auto text-sm text-ink-secondary">
          {queued.length} remaining
        </span>
      </div>

      {selected === undefined ? null : (
        <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle bg-surface-panel px-5 py-3">
          <span
            data-testid="sel-label"
            className="text-md font-semibold text-ink-primary"
          >
            {fieldLabel(selected.path)}
          </span>
          <StatePill state={selected.state} testId="sel-state" />
        </div>
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
