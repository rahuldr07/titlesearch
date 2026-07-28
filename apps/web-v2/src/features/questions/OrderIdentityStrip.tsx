import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";
import { ORDER_CLIENT_NAME, PERIOD_BADGE, PRODUCT_NAME } from "./orderContext";

/**
 * Client, product, ordered period — pinned above the questions.
 *
 * The action-coloured left edge is the design's marker for "this is the live
 * context", not decoration. The period is a mono chip because it is a range a
 * person compares character by character against what they searched; a
 * proportional font makes two dates that differ by a decade look alike.
 */
export function OrderIdentityStrip() {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-8 border border-line-strong border-l-(length:--stroke-accent) border-l-action bg-surface-panel px-7 py-5">
      <Eyebrow variant="caption">Client</Eyebrow>
      <span className="text-md font-semibold">{ORDER_CLIENT_NAME}</span>
      <span aria-hidden className="h-8 w-px bg-line-strong" />
      <Eyebrow variant="caption">Product</Eyebrow>
      <span className="text-md font-semibold">{PRODUCT_NAME}</span>
      <Chip tone="action" size="sm" shape="mono" bordered className="normal-case">
        {PERIOD_BADGE}
      </Chip>
    </div>
  );
}
