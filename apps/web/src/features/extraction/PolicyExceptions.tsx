import { useRead } from "../../app/useRead";
import { escalations as escalationsRead } from "../../shared/queries";

/**
 * POLICY EXCEPTIONS (design §Screens 6's last card). An exception here is an
 * `Escalation` (entities.ts:166) naming this order: a question the pipeline
 * could not answer from the rulebook. `Escalation.order_ids` is the server's
 * own join, so the membership test below is not a judgement about relevance.
 *
 * THERE IS NO RESOLVE CONTROL, and its absence is a product requirement:
 *   - Resolution is REFUSED WITHOUT A RULE (endpoints.ts:233-236,
 *     `INVARIANTS:109-110`), and drafting a rule is not something this can do.
 *   - `escalation.resolve` is senior/admin only (authz.ts:104); this screen is
 *     reached by anyone holding the order door.
 *   - `/escalations` (authz.ts:68) is where that mutation is authored, once.
 *
 * `resolution` non-null with `rule_id` null is drawn as the server has it — a
 * resolution the client re-judged is a client rulebook.
 *
 * NO COUNT. The design puts a "2 items" capsule on the header bar; no endpoint
 * serves an exception census for an order, and a length after a filter is a
 * number nothing else in the product could reconcile against (rule 11).
 */
export function PolicyExceptions(props: { readonly orderId: string }) {
  const escalations = useRead(escalationsRead);

  if (escalations.data === undefined) {
    return (
      <p className="font-sans text-meta leading-body text-ink-faint">
        {escalations.isError
          ? "The escalation list could not be read."
          : "Reading policy exceptions…"}
      </p>
    );
  }

  const namingThisOrder = escalations.data.escalations.filter((escalation) =>
    escalation.order_ids.includes(props.orderId),
  );

  if (namingThisOrder.length === 0) {
    return (
      <p
        data-testid="policy-exceptions-none"
        className="font-sans text-meta leading-body text-ink-secondary"
      >
        No escalation names this order. That is the server&apos;s answer, not an
        absence of one.
      </p>
    );
  }

  return (
    <ul data-testid="policy-exceptions" className="flex flex-col gap-8">
      {namingThisOrder.map((exception) => (
        <li
          key={exception.id}
          data-testid={`policy-exception-${exception.id}`}
          className="flex flex-col gap-3 border-b border-line-subtle pb-8 last:border-b-0 last:pb-0"
        >
          {/* The question is the title, because the question is what the
              exception is. */}
          <span className="font-sans text-meta font-bold leading-close text-ink-primary">
            {exception.question}
          </span>
          <span className="font-mono text-label leading-flat text-ink-muted">
            {exception.field_path_cluster}
          </span>
          {exception.resolution === null ? (
            <span className="font-sans text-label leading-body text-state-attend">
              Open — settled at the escalations door, and refused there without a
              rule.
            </span>
          ) : (
            <span className="font-sans text-label leading-body text-ink-secondary">
              {exception.resolution}
              {exception.rule_id !== null && (
                <span className="ml-4 font-mono text-ink-muted">
                  {exception.rule_id}
                </span>
              )}
              {exception.resolved_by !== null && (
                <span className="ml-4 text-ink-muted">
                  {exception.resolved_by}
                </span>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
