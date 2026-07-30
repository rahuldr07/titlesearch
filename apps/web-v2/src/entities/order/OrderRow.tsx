import type { ReactNode } from "react";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * One order as a queue band lists it.
 *
 * RULE: Mine, Held, In flight and Recently delivered are ONE row with different
 * slots filled. FAILURE PREVENTED: the four near-identical row renderers the
 * previous build grew (HANDOFF-UI §1). They arrived a band at a time and drifted
 * apart the same way, until the same order read differently depending on which
 * pile it happened to sit in.
 *
 * RULE: every clock belongs to an order, never to a person (§4.5). FAILURE
 * PREVENTED: `waited` is SERVER TEXT printed verbatim. There is no clock in this
 * file and nothing counts up — an elapsed timer on a work item is a pace
 * indicator wearing a helpful hat. Where the server sent no duration the block
 * is ABSENT rather than showing a `0` nobody measured.
 *
 * RULE: no queue cherry-picking, and absent beats disabled (§4.4). FAILURE
 * PREVENTED: the action is a slot this component cannot fill for itself. It has
 * no idea what taking work would mean, so it cannot offer it; a caller that
 * passes nothing draws nothing, and the greyed control that invites someone to
 * go and ask for permission never exists.
 *
 * RULE: the server owns severity (§4.3). FAILURE PREVENTED: `stateEdge` is
 * GIVEN. The row never reads it off `waited` — "long" is not a state — and never
 * off the state word, which the contract keeps a free string precisely so that
 * nobody writes a `switch` over it in a browser.
 */
export interface OrderRowProps {
  /** The order reference, mono, exactly as the server writes it. */
  orderRef: string;
  /** Chips beside the ref — the server's state word. Given, never derived. */
  chips?: ReactNode;
  /** Address and county, one server-written line. */
  place: string;
  /** What it is stopped on. Server text, verbatim. */
  note?: string | undefined;
  /** Server text like "1d 4h". Absent when the server sent none. */
  waited?: string | undefined;
  /** Resume / Open. Absent — never disabled — when the viewer may not act. */
  action?: ReactNode;
  /** The export's 2px inset top edge on a held row. `none` everywhere else. */
  stateEdge?: "none" | "attend" | "halt";
}

export function OrderRow({
  orderRef,
  chips,
  place,
  note,
  waited,
  action,
  stateEdge = "none",
}: OrderRowProps) {
  return (
    <Card accent={stateEdge} className="flex flex-wrap items-center gap-7 px-8 py-6">
      <div className="min-w-110 flex-1">
        <div className="flex flex-wrap items-baseline gap-5">
          <span className="font-mono text-md font-semibold whitespace-nowrap text-ink-primary">
            {orderRef}
          </span>
          {chips}
        </div>
        <p className="mt-2 text-tiny leading-close text-ink-muted">{place}</p>
        {note === undefined ? null : (
          <p className="mt-2 text-xs leading-close text-ink-secondary">{note}</p>
        )}
      </div>

      {waited === undefined ? null : (
        /* Literal capitals in the markup: a CSS `text-transform` does not change
           what the text says, and this label is OURS rather than the server's,
           so there is nothing to render verbatim. */
        <div className="text-right">
          <Eyebrow variant="stat" as="p">
            WAITING
          </Eyebrow>
          <p className="mt-1 font-mono text-md font-semibold text-ink-primary">{waited}</p>
        </div>
      )}

      {action}
    </Card>
  );
}
