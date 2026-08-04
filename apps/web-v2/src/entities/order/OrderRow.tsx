import type { ReactNode } from "react";
import { ListRow } from "../../shared/ui/ListRow";
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
 * is ABSENT rather than showing a `0` nobody measured. WAITING keeps the muted
 * neutral ink the mockup gives it (`.owait`): an age that turns red is a
 * productivity signal, and §4.5 has no colour for one.
 *
 * RULE: no queue cherry-picking, and absent beats disabled (§4.4). FAILURE
 * PREVENTED: the action is a slot this component cannot fill for itself. It has
 * no idea what taking work would mean, so it cannot offer it; a caller that
 * passes nothing draws nothing, and the greyed control that invites someone to
 * go and ask for permission never exists.
 *
 * RULE (2026-08-01 reskin): the mockup draws a queue band as ONE sheet of paper
 * with hairline-divided rows — `.rows` + `.orow`, a seven-cell grid at
 * `11px 18px` — not as a stack of floating cards. FAILURE PREVENTED: this row
 * was a `Card` wrapping three stacked lines, so five orders were five separate
 * pieces of paper ~86px tall where the drawing has five ~41px rows on one sheet.
 * That is the largest departure from the approved picture on screen 1, and it is
 * not a taste difference: card-per-row stops the band reading as a list you scan
 * down one column of and makes it a feed you read an item at a time. `ListRow`
 * already carries the mockup's `px-9 py-5.5` (18/11) and the interior hairline,
 * so the row's job here is only to lay the cells across it.
 *
 * THE SEVERITY EDGE LEFT THIS FILE WITH THE CARD. The mockup puts no accent on a
 * held ROW; `BandOrders` marks the band's own sheet once instead. A per-row edge
 * repeated down five rows was five claims where the server made one.
 *
 * WIDTHS ARE FIXED CELLS, NOT A GRID TEMPLATE, because `grid-cols-[104px_1fr…]`
 * is an arbitrary value and banned (§6). `w-52`/`w-86`/`w-59`/`w-48` are the
 * mockup's 104/172/118/96 on the 2px scale exactly. The address and the state
 * cell BOTH take `flex-1`, where the mockup gives only the address a `1fr`: our
 * rows carry the server's `waiting_on` sentence as well as its state word, and
 * the drawing's 168px state cell was measured against a two-word chip alone.
 */
export interface OrderRowProps {
  /** The order reference, mono, exactly as the server writes it. */
  orderRef: string;
  /** The server's state word, as a chip. Given, never derived. */
  chips?: ReactNode;
  /** The street address, one server-written line. */
  place: string;
  /** County and state, the server's own line. Its own column, muted. */
  where?: string | undefined;
  /** What it is stopped on. Server text, verbatim. */
  note?: string | undefined;
  /** Server text like "1d 4h". Absent when the server sent none. */
  waited?: string | undefined;
  /** Resume / Open. Absent — never disabled — when the viewer may not act. */
  action?: ReactNode;
}

export function OrderRow({
  orderRef,
  chips,
  place,
  where,
  note,
  waited,
  action,
}: OrderRowProps) {
  return (
    <ListRow className="flex flex-wrap items-center gap-7">
      <span className="w-52 shrink-0 font-mono text-md font-semibold text-ink-primary">
        {orderRef}
      </span>
      {/* `.oaddr` — one line, ellipsised. The address is what a reader scans a
          band for, so it gets elastic width and never wraps the row taller. */}
      <span className="min-w-64 flex-1 truncate text-lg font-medium text-ink-primary">
        {place}
      </span>
      <span className="w-86 shrink-0 truncate text-base text-ink-muted">{where}</span>
      <span className="flex min-w-64 flex-1 items-center gap-4">
        {chips}
        {note === undefined ? null : (
          <span className="truncate text-base text-ink-secondary">{note}</span>
        )}
      </span>

      {waited === undefined ? null : (
        /* Literal capitals in the markup: a CSS `text-transform` does not change
           what the text says, and this label is OURS rather than the server's,
           so there is nothing to render verbatim. Label and age sit on ONE line
           (`.owait`) where they used to stack — the two-line block is half the
           reason the row stood at 86px. */
        <span className="w-59 shrink-0 text-right font-mono text-xs text-ink-muted">
          <Eyebrow variant="stat" as="span">
            WAITING
          </Eyebrow>{" "}
          <span className="tnum font-semibold text-ink-primary">{waited}</span>
        </span>
      )}

      {action === undefined ? null : (
        <span className="flex w-48 shrink-0 justify-end">{action}</span>
      )}
    </ListRow>
  );
}
