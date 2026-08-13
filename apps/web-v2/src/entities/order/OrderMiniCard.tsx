import type { ReactElement } from "react";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * ONE ORDER, SMALL — the card the board stacks in a column and the card the
 * failed banner lays in a row.
 *
 * RULE: one render, one place. These were the same twenty lines written twice
 * inside ONE feature folder, and the copies had already drifted — the banner
 * printed "Needs a person to put it back" where the server sent nothing, and
 * the column printed nothing at all. FAILURE PREVENTED: a second copy of a
 * render is a second chance to emit a sentence no server ever said, which is
 * principle 6 (never emit a value you cannot cite) losing by duplication
 * rather than by argument.
 *
 * FOUR FACTS AND NO MORE: which order, where, how long it has sat, and what it
 * is stopped on. The last one is the card's whole reason to exist — a card
 * that showed only "how long" would be a lateness display, and lateness is not
 * actionable. "Sign-off open" tells a person what to go and do.
 *
 * NOTHING HERE COUNTS. `waited` is SERVER TEXT rendered verbatim; there is no
 * clock in this component and nothing ticks up. An elapsed timer on a work item
 * is a pace indicator wearing a helpful hat, and this product does not pace
 * people.
 */
export interface OrderMiniCardProps {
  /**
   * The human reference, e.g. `4176034-1`. Named `ref` by the cross-wave
   * signature ruling; React 19 passes `ref` to a function component as an
   * ordinary prop, so the name costs nothing here and the alternative was two
   * waves disagreeing about `orderRef` at every call site.
   */
  ref: string;
  /** The line under the reference — address and place, the server's words. */
  place: string;
  /**
   * REQUIRED AND NULLABLE, deliberately. The wire says `string | null`, so a
   * caller must state which it holds; `null` means the server said nothing and
   * the line is not drawn. An optional prop would let a call site forget it,
   * and a dash in its place reads as a value the fixture failed to supply.
   */
  waited: string | null;
  /** What it is stopped on. Absent or null → the line is not drawn. */
  waitingOn?: string | null | undefined;
  /**
   * The SERVER'S WORD for where the order stands ("Delivery failed"). A label
   * and never an enum: an enum here invites `switch (state)` in the browser,
   * which is the client-side state machine hard rule 3 puts on the server.
   */
  state?: string | undefined;
  /** Server-supplied. Draws the YOURS badge and the live edge — never guessed. */
  mine?: boolean | undefined;
  /** `halt` is an order off the pipeline: panel ground, halt hairline. */
  tone?: "none" | "halt" | undefined;
  /** Where the card opens. Absent → the card is not a link, and that is the default. */
  to?: string | undefined;
}

export function OrderMiniCard({
  ref,
  place,
  waited,
  waitingOn,
  state,
  mine = false,
  tone = "none",
  to,
}: OrderMiniCardProps): ReactElement {
  const foot = waited !== null || (waitingOn !== null && waitingOn !== undefined);

  const card = (
    <Card
      size="nested"
      className={cn(
        "p-4",
        /* The export draws a failed card on PANEL with a red hairline, not on
           the red tint — the tint belongs to the banner around it. `Card`'s
           `tone="halt"` would ground the card itself, so only the edge moves. */
        tone === "halt" && "border-state-halt-border",
        /* Violet, and thicker: "yours" has to be findable on a seven-column
           board at a glance. The YOURS badge carries the same fact in words, so
           the mark survives greyscale without leaning on the colour. */
        mine && "border-(length:--stroke-accent) border-action",
        to !== undefined && "hover:border-action",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-xs font-semibold text-ink-primary">{ref}</span>
        {mine ? (
          <Chip tone="inverse" size="micro">
            YOURS
          </Chip>
        ) : null}
        {state === undefined ? null : (
          <Eyebrow variant="caption" tone={tone === "halt" ? "halt" : "muted"}>
            {state}
          </Eyebrow>
        )}
      </div>
      <p className="mt-2 text-tiny leading-close text-ink-muted">{place}</p>
      {foot ? (
        <div className="mt-3 border-t border-line-subtle pt-3">
          {waited === null ? null : (
            <p className="font-mono text-tiny text-ink-secondary">{waited}</p>
          )}
          {waitingOn === null || waitingOn === undefined ? null : (
            <p className="mt-1 text-tiny leading-close text-ink-muted">{waitingOn}</p>
          )}
        </div>
      ) : null}
    </Card>
  );

  /*
   * A plain anchor, not a typed `<Link>`: §6 keeps the router out of
   * `entities/`, and a card that is a link is one Tab rather than a nested
   * control. `to` is absent on the overview board on purpose — see
   * `OverviewScreen`'s note on cherry-picking.
   */
  return to === undefined ? (
    card
  ) : (
    <a href={to} className="block">
      {card}
    </a>
  );
}
