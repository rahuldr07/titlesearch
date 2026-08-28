import type { OrderContextResponse, OrderSignoffResponse } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";

/**
 * ABSTRACT SPECIFICATIONS — design §Screens 4's "facts grid".
 *
 * What was ordered, over what span, against how many pages, and who signed for
 * it. Every cell is a server field; the grid does no joining and no formatting.
 *
 * ══ NULL IS A STATEMENT AND THE THREE NULLS MEAN DIFFERENT THINGS ══════════
 *
 * `entities.ts:45-53`, restated on `OrderContextResponse` (`intake.ts:301`):
 * "an order that failed validation has no resolved product and an unreadable
 * package has no page count. `null` IS THAT STATEMENT — `0` would be a count,
 * and a count is a claim." So each absent value prints its own meaning. The
 * design's `—` says all three at once, which is to say it says none of them.
 *
 * `period_label` is a RENDERED LABEL and never a machine-readable span
 * (`entities.ts:53-56`). It is printed and never parsed — §8's date rule from
 * the other direction: the correct handling of a server date string is to pass
 * it through untouched.
 *
 * ══ THE SIGNATURE IS A RECORD, WITH NO WAY TO EDIT IT ══════════════════════
 *
 * `INVARIANTS:75`: "Review shows the intake signature AS A RECORD, with no way
 * to edit it." `OrderSignoffResponse.signed_by` is null until a person signs,
 * and `intake.ts:66` adds the half that matters: "POLICY PREFILL NEVER FILLS
 * THIS IN." An unsigned sign-off therefore prints as unsigned, not as a blank
 * that could be mistaken for a name that failed to load.
 */
export function SpecificationsGrid(props: {
  readonly context: OrderContextResponse | undefined;
  readonly signoff: OrderSignoffResponse | undefined;
}) {
  return (
    <Card padding="none">
      <CardHeader>Abstract specifications</CardHeader>
      <CardBody className="py-10">
        {props.context === undefined ? (
          <p className="text-meta leading-body text-ink-muted">
            The server has not described this order.
          </p>
        ) : (
          <dl className="grid grid-cols-3 gap-x-14 gap-y-8">
            <Cell
              term="Order"
              value={props.context.order_ref}
              data
            />
            <Cell
              term="Product"
              value={props.context.product}
              absent="No resolved product — the order did not pass validation"
            />
            <Cell
              term="Period"
              value={props.context.period_label}
              absent="No period on record"
            />
            <Cell
              term="Package"
              value={
                props.context.pages === null
                  ? null
                  : `${props.context.pages} pages`
              }
              absent="Page count unread — nobody could read the package"
              data
            />
            <Cell
              term="Signed off by"
              value={props.signoff?.signed_by ?? null}
              absent="Not signed — policy may have suggested answers, but nobody has claimed them"
            />
            <Cell
              term="Signed at"
              value={props.signoff?.signed_at ?? null}
              absent="Not signed"
              data
            />
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * One fact. `absent` is required wherever the wire may be null, which is rule
 * 14's typed absence applied at order level rather than at field level.
 */
function Cell(props: {
  readonly term: string;
  readonly value: string | null;
  readonly absent?: string;
  readonly data?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="text-label font-bold leading-flat text-ink-faint">
        {props.term}
      </dt>
      {props.value === null ? (
        <dd className="text-meta leading-body text-ink-faint">
          {props.absent ?? "Not stated"}
        </dd>
      ) : (
        <dd
          className={
            props.data === true
              ? "font-mono text-meta leading-close tabular-nums text-ink-primary"
              : "text-meta leading-close text-ink-primary"
          }
        >
          {props.value}
        </dd>
      )}
    </div>
  );
}
