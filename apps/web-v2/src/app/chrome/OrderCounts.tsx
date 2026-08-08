import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import type { OrderCensus } from "@titlepipe/contract";
import { OrderFieldsResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { CensusTile, type CensusTileProps } from "../../shared/ui/CensusTile";

/** The tone names `CensusTile` accepts, so the table below states one of them. */
type CensusTone = NonNullable<CensusTileProps["tone"]>;

function fieldsQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "fields"],
    queryFn: () => get(`/api/orders/${orderId}/fields`, OrderFieldsResponse),
  });
}

/**
 * The four numbers that describe an order, in the chrome, on every order screen.
 *
 * FIELDS · AUTO-CONFIRMED · NEED YOU · NO SOURCE. Three of those are ordinary
 * workload. The fourth is the one that matters: NO SOURCE counts values the
 * pipeline produced without a document, page or reading behind them, and
 * principle 6 says a value you cannot cite must never render as an ordinary
 * one. Putting the count in the chrome means nobody has to go looking for it.
 *
 * THESE ARE NOT A THROUGHPUT DISPLAY. There is no rate, no elapsed time and no
 * per-person number anywhere in this product. A count of what is left is the
 * shape of the work; a count per hour is a target, and a target is how a
 * reviewer learns to stop reading carefully.
 *
 * EVERY FIGURE IS READ FROM `census`, NEVER COMPUTED HERE. This component used
 * to derive all four from the `fields` array while its own docstring claimed
 * they were "derived from server state only" — untrue of NO SOURCE, the one
 * that mattered. It filtered for `value !== null && source_doc_id === null &&
 * source_page === null && readings.length === 0` and printed the result as a
 * headline number: the browser ruling on provenance, which is a server
 * judgement (hard rule 3) and one no screen can cite (principle 6).
 * `Field.state` cannot stand in for it — the enum is pending/auto_confirmed/
 * needs_review/confirmed/corrected/escalated and carries no no-source member,
 * so nothing server-authored was left to count. Hence `OrderCensus`.
 *
 * `fields.length` was the same defect, quietly: the array is scoped to what the
 * caller may see, the census is not.
 *
 * `whyComments.test.ts` holds that claim to the file rather than to this
 * paragraph: no `.filter(`, no `.length`, no comparison against `null` here.
 */
/**
 * RULE (2026-08-01 reskin): a census figure is drawn by `CensusTile`, and its
 * `strip` size IS the mockup's `.rstrip .stat` — figure and word on ONE
 * baseline-aligned line, `21 FIELDS`, at `--text-census` in tabular mono.
 * FAILURE PREVENTED: this file hand-rolled the tile and had drifted to the
 * BOARD reading — a 9.5px cap stacked under a 13px numeral, right-aligned —
 * inside 26px of chrome. Four stacked tiles in a 40px-tall strip read as eight
 * unrelated fragments; the shared component was written against the drawing and
 * simply had no caller here. Tones become the component's semantic names rather
 * than four text-colour utilities spelled out beside a label.
 */
const TILES = [
  { key: "fields", label: "Fields", tone: undefined, muteAtZero: false },
  {
    key: "auto_confirmed",
    label: "Auto-confirmed",
    tone: "settled",
    muteAtZero: false,
  },
  { key: "needs_review", label: "Need you", tone: "action", muteAtZero: false },
  // Zero no-source is the good outcome, so it recedes; any other figure is the
  // loudest thing on the strip.
  { key: "no_source", label: "No source", tone: "halt", muteAtZero: true },
] as const satisfies readonly {
  key: keyof OrderCensus;
  label: string;
  tone: CensusTone | undefined;
  muteAtZero: boolean;
}[];

export function OrderCounts({ orderId }: { orderId: string }) {
  const { data } = useQuery(fieldsQuery(orderId));
  if (data === undefined) return null;
  const census = data.census;

  return (
    // NO BREAKPOINT HIDES THESE, AND THAT IS AN UNCLOSED GAP, not a ruling.
    // The export sets `countsDisplay: compact ? 'none' : 'flex'` below 1180px
    // (`TitlePipe.dc.html:2447`, `:3770`) and the design spec ruled to ADOPT
    // it; nothing here implements that yet. Open item G1 in `conflicts.md` —
    // do not read this comment as the decision going the other way.
    //
    // The comment this replaces read "always visible, never breakpoint-hidden",
    // which stated the gap as though it were the rule. What is true today is
    // only the literal fact, and `whyComments.test.ts` now checks that fact
    // rather than the claim: no responsive-visibility utility appears in this
    // file. "Always visible" was never true either — this returns null until
    // the query resolves, and `OrderStrip` mounts it only on an order screen.
    // 18px tile to tile — the mockup's `.rstrip` gap, which is the gap between
    // every item on that strip including these.
    <div data-testid="order-counts" className="flex flex-wrap items-center gap-9">
      {TILES.map(({ key, label, tone, muteAtZero }) => {
        // An ABSENT census prints an em dash — not a zero, and not a number
        // this component worked out for itself. "The server did not say" and
        // "there are none" are different statements, and collapsing them is how
        // a screen reports a clean order while the figure that would have
        // flagged it was never sent at all.
        const value = census?.[key];
        const muted = value === undefined || (muteAtZero && value === 0);
        return (
          <CensusTile
            key={key}
            size="strip"
            value={value ?? "—"}
            caption={label}
            {...(muted ? { tone: "muted" } : tone ? { tone } : {})}
          />
        );
      })}
    </div>
  );
}
