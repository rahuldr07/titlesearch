import type { Reconciliation } from "@titlepipe/contract";
import { Badge, Card, CardBody, CardHeader } from "../../components/ui";

/**
 * THE ONE THING THE PROGRAMME ACTUALLY PUBLISHES: where two seats keyed the
 * same path and differed.
 *
 * `Reconciliation` (entities.ts:202-214) is SYMMETRIC — `value_a` and
 * `value_b`, and the model is not a party to the row. That symmetry is what
 * makes this safe to draw on an ops screen: a divergence says two humans read
 * a document differently, and says nothing about what the machine read.
 *
 * ══ NOTHING IS COUNTED HERE ════════════════════════════════════════════════
 *
 * No total, no "3 open", no ratio. INVARIANT 5: the UI never re-derives counts.
 * A length taken over a filtered array is the exact defect
 * `intake.ts:330-334` names in another register — a figure that shrinks with
 * your permissions and reads as work vanishing. Whether a divergence is ruled
 * is read off the SERVER's `ruling_value`, per row, and never aggregated.
 *
 * ══ A NULL SIDE IS AMBIGUOUS, AND THE ROW SAYS SO ══════════════════════════
 *
 * Rule 14 and INVARIANT 7: absence is typed, four ways, and the four never
 * collapse. `BlindEntryInput` carries `na_reason` (entities.ts:289-296) and
 * `Reconciliation` DOES NOT — so a null `value_a` on this screen cannot be told
 * apart from "that seat recorded NOT_STATED". It is printed as an unattributed
 * absence rather than as a dash, and the gap beneath the list carries the ask.
 */
export function DivergenceList(props: { readonly rows: readonly Reconciliation[] }) {
  return (
    <Card padding="none">
      <CardHeader>Where the two seats disagreed</CardHeader>
      {props.rows.length === 0 ? (
        <CardBody>
          <p className="text-meta leading-body text-ink-secondary">
            The server returned no divergence rows for this package. That is not
            the same as &ldquo;the seats agreed&rdquo;: a row exists only once
            both seats have keyed the same path and differed, so an empty list
            equally means nobody has keyed it yet. `ReconciliationResponse`
            (endpoints.ts:338-342) carries no member that tells the two apart.
          </p>
        </CardBody>
      ) : (
        <ul>
          {props.rows.map((row) => (
            <li
              key={row.id}
              data-testid={`divergence-${row.id}`}
              className="flex flex-col gap-6 border-b border-line-subtle px-12 py-10 last:border-b-0"
            >
              <div className="flex items-baseline justify-between gap-8">
                <span className="font-mono text-meta font-semibold leading-close text-ink-primary">
                  {row.path}
                </span>
                {row.ruling_value === null ? (
                  <Badge tone="attend">Open</Badge>
                ) : (
                  <Badge tone="settled">Ruled</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-8">
                <Side seat="Seat A" value={row.value_a} />
                <Side seat="Seat B" value={row.value_b} />
              </div>

              {row.ruling_value !== null && (
                <p className="text-meta leading-body text-ink-secondary">
                  Ruled{" "}
                  <span className="font-mono text-ink-primary">{row.ruling_value}</span> by{" "}
                  {row.ruled_by ?? "an unnamed actor"} on{" "}
                  <span className="font-mono">{row.citation ?? "no citation recorded"}</span>
                  {row.reason !== null && ` — ${row.reason}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Side(props: { readonly seat: string; readonly value: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-semibold leading-flat text-ink-faint">
        {props.seat}
      </span>
      {props.value === null ? (
        <span className="text-meta leading-close text-ink-muted">
          No value recorded — the shape does not say which absence
        </span>
      ) : (
        <span className="font-mono text-meta leading-close text-ink-primary">
          {props.value}
        </span>
      )}
    </div>
  );
}
