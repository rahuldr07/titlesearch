import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";

/**
 * Product, ordered period, and whether anyone has signed yet — pinned above the
 * questions.
 *
 * It is restated here rather than assumed remembered because the answers mean
 * different things per product: the same "yes" against a Two Owner Search and
 * against a 30 Year Search are two different claims, and a person who has lost
 * track of which order this is will sign the wrong one without noticing.
 *
 * The action-coloured left edge is the design's marker for "this is the live
 * context", not decoration. The period is a mono chip because it is a span a
 * person compares character by character against what they searched.
 *
 * SIGNED IS A SERVER FACT, and null until a person signs — policy prefill never
 * fills it in. The strip prints the server's answer and never infers one from
 * how many lines happen to be answered on screen.
 *
 * CONTRACT GAP: the sign-off payload carries no client name and no statement of
 * how this client's list differs from the baseline. The design named both above
 * the questions; neither is on the wire.
 */
export function OrderIdentityStrip({
  productName,
  periodLabel,
  signedBy,
  signedAt,
}: {
  productName: string;
  periodLabel: string;
  signedBy: string | null;
  signedAt: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-8 border border-line-strong border-l-(length:--stroke-accent) border-l-action bg-surface-panel px-7 py-5">
      <Eyebrow variant="caption">Product</Eyebrow>
      <span className="text-md font-semibold">{productName}</span>
      <Chip tone="action" size="sm" shape="mono" bordered className="normal-case">
        {periodLabel}
      </Chip>
      <span aria-hidden className="h-8 w-px bg-line-strong" />
      <Eyebrow variant="caption">Signed</Eyebrow>
      {signedBy === null ? (
        <span className="text-sm text-ink-muted">Not signed</span>
      ) : (
        <span className="text-sm text-state-settled-ink">
          {signedBy}
          {signedAt === null ? "" : ` · ${signedAt}`}
        </span>
      )}
    </div>
  );
}
