import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";

const FACETS = ["Person", "Order", "Action"] as const;

/**
 * The three facets the design draws over the record — and the reason none of
 * them does anything yet.
 *
 * CONTRACT GAP: `GET /api/audit` takes no query parameters and returns no
 * cursor. There is nothing to send a facet to.
 *
 * FILTERING CLIENT-SIDE WOULD BE WORSE THAN NOT FILTERING. The endpoint returns
 * one page of the record with no total and no cursor, so a client-side filter
 * would narrow whatever slice happened to arrive and present the result as "all
 * of R. Delacroix's acts". On an append-only record whose entire value is being
 * complete, a filter that silently omits rows is not a convenience — it is the
 * failure mode. The controls are therefore drawn and disabled, with the reason
 * stated, rather than wired to a lie.
 *
 * They are drawn at all because the shape of the record is part of reading it:
 * a reader can see that person, order and action are the axes this log is meant
 * to be questioned along, which is worth more than a clean empty toolbar.
 */
export function AuditFilters() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-ink-muted">Filter:</span>
        <ToggleGroup aria-label="Filter the record" value={[]}>
          {FACETS.map((facet) => (
            <Toggle key={facet} value={facet} disabled>
              {facet}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>
      <p className="text-xs leading-body text-ink-muted">
        Filtering is not wired — the audit endpoint takes no query parameters, and
        narrowing one page of an append-only record on the client would show a partial
        answer as a complete one.
      </p>
    </div>
  );
}
