import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";

/**
 * What is being signed: the product ordered and the period it covers, pinned
 * above the questions.
 *
 * It is restated here rather than assumed remembered because the answers mean
 * different things per product: the same "yes" against a Two Owner Search and
 * against a 30 Year Search are two different claims, and a person who has lost
 * track of which order this is will sign the wrong one without noticing.
 *
 * The action-coloured stripe is the design's marker for "this is the live
 * context", not decoration — and it is a 2px stripe along the TOP, which is the
 * axis `Card accent` draws. Spelled by hand it sat on the LEFT edge, where a
 * 4px `--stroke-severity` rule means "this is a problem": the strip was
 * competing for alarm with the gate banners on the neighbouring screen while
 * only ever meaning "this is the order you are signing". The period is a mono
 * chip because it is a span a person compares character by character against
 * what they searched.
 *
 * THE SIGNATURE IS NOT ON THIS STRIP. RULE: one fact, stated once, where it is
 * acted on. FAILURE PREVENTED: signed-ness was drawn here, again in a banner
 * inside the card, and again by which card the screen chose to render — three
 * statements of one server field on a screen whose entire subject is that
 * field. The choice of card IS the statement: `SignoffCard` is only ever drawn
 * on an unsigned order, and `SignoffReadonly` carries the signer and the
 * timestamp in its own header, which is where the design puts them.
 *
 * CONTRACT GAP: the design's strip opens with CLIENT and the client's name. The
 * client is what RESOLVES which thirteen lines this order got, so it is the
 * strip's most load-bearing fact. `OrderSignoffResponse` carries no client
 * name, and the pair is left off rather than drawn with a placeholder in it —
 * the response needs `client_name` before this can be honest.
 *
 * CONTRACT GAP: the design also banners how this client's list differs from the
 * baseline ("1 line waived, 1 scoped"). That statement has to arrive RESOLVED —
 * counting a client's overrides here would be a second resolver, free to
 * disagree with the one that decided what was actually ordered.
 */
export function OrderIdentityStrip({
  productName,
  periodLabel,
}: {
  productName: string;
  periodLabel: string;
}) {
  return (
    <Card accent="action" className="flex flex-wrap items-center gap-5 px-7 py-5">
      <Eyebrow variant="caption">Product</Eyebrow>
      <span className="text-md font-semibold">{productName}</span>
      <Chip tone="action" size="sm" shape="mono" bordered className="normal-case">
        {periodLabel}
      </Chip>
    </Card>
  );
}
