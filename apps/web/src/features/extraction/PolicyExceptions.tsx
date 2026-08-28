import { useQuery } from "@tanstack/react-query";
import { get } from "../../shared/api";
import { escalations as escalationsRead } from "../../shared/queries";

/**
 * POLICY EXCEPTIONS (design §Screens 6's last card).
 *
 * An exception on this screen is an `Escalation` (entities.ts:166) touching
 * this order: a question the pipeline could not answer from the rulebook.
 * `Escalation.order_ids` is the join, so the filter is a membership test on a
 * server-supplied array rather than a judgement about which escalations are
 * relevant.
 *
 * ══ WHAT IS SHOWN, AND THE ONE THING THAT IS NOT ═══════════════════════════
 *
 * `question`, `resolution`, `rule_id` and `resolved_by` are printed as the
 * server holds them. There is NO resolve control here, and its absence is a
 * product requirement rather than scope:
 *
 *   - Resolution is REFUSED WITHOUT A RULE (endpoints.ts:233-236,
 *     `INVARIANTS:109-110`), and drafting a rule is not something this screen
 *     can do.
 *   - `escalation.resolve` is held by senior/admin only (authz.ts:104), and
 *     this screen is reached by anyone with the order door.
 *   - The escalations world has its own door (`/escalations`, authz.ts:68).
 *     Duplicating the determination here would be a second place the same
 *     mutation is authored.
 *
 * So an unresolved exception states that it is unresolved and names where it
 * is settled. `resolution` non-null with `rule_id` null is drawn as the server
 * has it and is not "corrected" here — a resolution the client re-judged is a
 * client rulebook.
 *
 * ══ NO COUNT ══════════════════════════════════════════════════════════════
 *
 * The design puts a "2 items" capsule on this card's header bar. It is not
 * drawn. The card prints rows, never "N exceptions". No endpoint serves an
 * exception census for an order, and `escalations.length` after a filter is
 * a number nobody could reconcile against the hub — rule 11 wants one
 * variable, and this would be the only literal.
 */
export function PolicyExceptions(props: { readonly orderId: string }) {
  const escalations = useQuery({
    queryKey: escalationsRead.key,
    queryFn: () => get(escalationsRead.path, escalationsRead.schema),
  });

  if (escalations.data === undefined) {
    return (
      <p className="font-sans text-meta leading-body text-ink-faint">
        {escalations.isError
          ? "The escalation list could not be read."
          : "Reading policy exceptions…"}
      </p>
    );
  }

  const mine = escalations.data.escalations.filter((e) =>
    e.order_ids.includes(props.orderId),
  );

  if (mine.length === 0) {
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

  /*
   * The design's item: a 13px bold title over an 11px body, items separated by
   * a hairline and spaced 16px apart. The QUESTION is the title, because the
   * question is what the exception is; the cluster path and the disposition are
   * the body beneath it.
   */
  return (
    <ul data-testid="policy-exceptions" className="flex flex-col gap-8">
      {mine.map((exception) => (
        <li
          key={exception.id}
          data-testid={`policy-exception-${exception.id}`}
          className="flex flex-col gap-3 border-b border-line-subtle pb-8 last:border-b-0 last:pb-0"
        >
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
