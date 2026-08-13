import { DEMO_AMENDED_FIELD, DEMO_ORDER_HISTORY } from "./demoContent";
import { SheetHeading } from "./SheetHeading";
import { Card } from "../../shared/ui/Card";
import { DividedSection, ListRow } from "../../shared/ui/ListRow";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Stamp } from "../../shared/ui/Stamp";

/**
 * The amended sheet: a v2 went out, and this is the record of what changed.
 *
 * V1 IS SHOWN, STRUCK THROUGH, NEXT TO V2 — never replaced. The pair IS the
 * defect record (`delivery-complaints.spec` #2): a v2 existing at all means v1
 * went to a client wrong, and collapsing to "current value" erases the only
 * on-screen evidence that happened. Struck rather than dropped, because the
 * person reading this is usually answering "what did we send them?".
 *
 * "All other fields — unchanged, carried forward from v1" is stated EXPLICITLY
 * rather than left as an empty table. An amended sheet that lists one row is
 * ambiguous between "one field changed" and "we only re-checked one field", and
 * those are very different answers to give a client in a dispute. Saying the
 * rest carried forward as settled closes it.
 *
 * The stamp is ACTION, not halt. A reissue is a correction someone made, which
 * belongs in the same register as every other human amendment in the product —
 * not in the register reserved for things that stopped.
 */
export function ReissuedSheet({ orderId }: { orderId: string }) {
  return (
    <div data-testid="reissued-sheet">
      <div className="mb-11">
        <Stamp tone="action" size="lg">
          Reissued · v2
        </Stamp>
      </div>

      {/*
        `amended sheet` IS THE CLOSING PHRASE AND IT IS THE NEWS. RULE: the
        emphasis marks what the heading is telling you that you did not already
        know. FAILURE PREVENTED: leaving this h1 the only unmarked one of the
        pair, so the terminal state carries the design's accent and the state
        that actually needs explaining does not.
      */}
      <SheetHeading size="md">
        Order {orderId} — <em>amended sheet</em>
      </SheetHeading>
      <p className="mx-auto mb-9 max-w-150 text-base leading-body text-ink-secondary">
        v1 retained in the record. Only the disputed field was reworked; everything else
        carried forward as settled.
      </p>

      <Card className="mb-8 text-left">
        <div className="grid grid-cols-3 border-b border-line-subtle bg-surface-sunken px-7 py-5">
          <Eyebrow variant="field">Field</Eyebrow>
          <Eyebrow variant="field">v1</Eyebrow>
          <Eyebrow variant="field" tone="action">
            v2
          </Eyebrow>
        </div>

        {/*
          The hairline between the two rows used to be spelled by OMISSION — the
          first row simply had no `border-t`, the second did. That is a fact
          about the source order, not about the DOM: adding a row above, or
          rendering the diff from a list once the server owns it, doubles the
          hairline under the header and nobody notices until it ships.
          `DividedSection` names the boundary the `first:` exemption is measured
          against, so the rule survives the row set changing. The padding is the
          sheet's own 14/10 and is kept — `ListRow`'s two measured steps are the
          card row and the rail row, and a third variant for this would ratify a
          scale nobody designed.
        */}
        <DividedSection as="div">
          <ListRow as="div" className="grid grid-cols-3 items-baseline px-7 py-5">
            <span className="text-sm text-ink-secondary">
              {DEMO_AMENDED_FIELD.label}
            </span>
            <span className="font-mono text-sm text-ink-muted line-through">
              {DEMO_AMENDED_FIELD.v1}
            </span>
            <span
              data-testid="amended-v2"
              className="font-mono text-sm font-semibold text-action-ink"
            >
              {DEMO_AMENDED_FIELD.v2}
            </span>
          </ListRow>

          <ListRow as="div" className="grid grid-cols-3 items-baseline px-7 py-5">
            <span className="text-sm text-ink-muted">All other fields</span>
            <span className="col-span-2 text-xs text-ink-muted">
              unchanged — carried forward from v1
            </span>
          </ListRow>
        </DividedSection>
      </Card>

      <p className="text-xs text-ink-muted">{DEMO_ORDER_HISTORY}</p>
    </div>
  );
}
