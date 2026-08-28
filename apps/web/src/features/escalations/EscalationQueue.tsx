import type { Escalation } from "@titlepipe/contract";
import { Card, CardBody, CardHeader, Empty, Skeleton, cx } from "../../components/ui";

/**
 * THE INBOX. `INVARIANTS:39` — no triage furniture: no category, no priority,
 * no assignee, and no sort control either, because every sort key a queue could
 * offer is a triage field the `Escalation` shape refuses to carry
 * (entities.ts:166-175). The order is the SERVER's array order, printed.
 *
 * Rule 6: one status signal per row. The signal is the ◆ mark plus weight on an
 * unresolved cluster, not a capsule — this is a list, not a moment of record.
 *
 * `resolved` is read off `rule_id`, which is the server's field and is also the
 * mandatory rule restated: a cluster with a ruling and no rule is NOT resolved
 * (`INVARIANTS:36`, and `EscalationCard` carries the same reading). Nothing here
 * derives it from `resolution` alone.
 */
export function EscalationQueue({
  escalations,
  loading,
  selectedId,
  onSelect,
}: {
  readonly escalations: readonly Escalation[];
  readonly loading: boolean;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <Card padding="none">
      <CardHeader>Open clusters</CardHeader>
      <CardBody className="flex flex-col gap-2 p-0">
        {loading ? (
          <div className="flex flex-col gap-4 p-10">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : escalations.length === 0 ? (
          <Empty
            title="Nothing escalated"
            reason="No reviewer has raised a question that the rulebook does not already answer."
          />
        ) : (
          escalations.map((escalation) => {
            const resolved = escalation.rule_id !== null;
            const selected = escalation.id === selectedId;
            return (
              <button
                key={escalation.id}
                type="button"
                data-testid={`escalation-${escalation.id}`}
                data-cluster={escalation.field_path_cluster}
                data-resolved-by-rule={resolved}
                aria-current={selected}
                onClick={() => onSelect(escalation.id)}
                className={cx(
                  "tp-state flex cursor-pointer flex-col gap-3 border-b border-line-subtle px-10 py-8 text-left",
                  "last:border-b-0 hover:bg-surface-sunken",
                  selected && "bg-surface-sunken",
                )}
              >
                <span className="font-mono text-label leading-flat text-ink-muted">
                  {escalation.field_path_cluster}
                </span>
                <span
                  className={cx(
                    "font-sans text-meta leading-close text-ink-primary",
                    !resolved && "font-semibold",
                  )}
                >
                  {/* The one signal. ◆ = open. Rule 7's glyph vocabulary. */}
                  <span aria-hidden className="pr-3 text-ink-muted">
                    {resolved ? "" : "◆"}
                  </span>
                  {escalation.question}
                </span>
                <span className="font-mono text-label leading-flat text-ink-faint">
                  {escalation.order_ids.length === 1
                    ? escalation.order_ids[0]
                    : `${String(escalation.order_ids.length)} orders`}
                </span>
              </button>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
