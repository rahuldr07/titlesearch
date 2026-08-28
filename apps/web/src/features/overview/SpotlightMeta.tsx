import type { Order } from "@titlepipe/contract";

/**
 * ROW 3 OF THE SPOTLIGHT — what was ordered, over what span, in how many pages.
 *
 * The prototype draws it as `product pill · Client: … · pages`, 13px mono
 * `#6E7480`, with a "•" between items.
 *
 * ══ EACH ITEM PRINTS ONLY IF THE ORDER CARRIES IT ══════════════════════════
 *
 * `product`, `period_label` and `pages` are all on `Order` and all nullable,
 * and null is a statement rather than a hole — "an order that failed validation
 * has no resolved product, and a package nobody could read has no page count.
 * `null` is that statement. `0` would be a count, and a count asserts somebody
 * looked" (`entities.ts:48-51`). So an absent item is absent, never `0`, never
 * an em dash standing in for a value nothing supplied.
 *
 * ══ THE CLIENT NAME IS THE GAP ═════════════════════════════════════════════
 *
 * The prototype's "Client: Mortgage Connect" cannot be drawn. `Order` carries
 * `client_id`, an opaque handle, and no endpoint turns one into a name.
 * Printing `cli_hollowyn` under the word "Client" would be worse than omitting
 * it — it names nothing a reader recognises while looking like it does.
 *
 * ══ MONO IS ON THE PAGE COUNT ONLY ═════════════════════════════════════════
 *
 * The prototype sets the whole row in JetBrains Mono. Rule 3's list of what
 * mono is for is closed — "order refs, money, citations, hashes, timestamps,
 * kbd" — and a product name and a period label are neither identifiers nor
 * figures. The page count is a citation figure against the package, so it keeps
 * the face and the rest of the row does not.
 */
export function SpotlightMeta(props: { readonly order: Order }) {
  const order = props.order;

  return (
    <div className="flex flex-wrap items-center gap-6 text-meta leading-close text-ink-muted">
      {order.product !== null && (
        <span className="rounded-lg bg-surface-app px-5 py-1 font-semibold text-ink-primary">
          {order.product}
        </span>
      )}
      {order.period_label !== null && (
        <>
          <Dot />
          <span>{order.period_label}</span>
        </>
      )}
      {order.pages !== null && (
        <>
          <Dot />
          <span className="font-mono">{order.pages} pp</span>
        </>
      )}
    </div>
  );
}

/**
 * The row's separator, drawn as its own element rather than baked into each
 * label, so that an item the order does not carry takes its separator with it —
 * a leading or doubled bullet is how a conditional row announces the field it
 * is missing.
 *
 * `aria-hidden`: it is punctuation between items a screen reader already reads
 * as separate elements. Rule 7's glyph vocabulary is about status marks, which
 * this is not.
 */
function Dot() {
  return (
    <span aria-hidden className="text-ink-disabled">
      •
    </span>
  );
}
