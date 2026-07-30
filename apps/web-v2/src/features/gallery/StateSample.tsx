import type { GalleryAccent } from "./galleryStates";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * The banner every non-terminal state is drawn as: a tinted block with a
 * severity edge down its left side.
 *
 * ONE SHAPE, FOUR TONES — and that is deliberate. A reader should not have to
 * learn a new layout to find out what happened; they should recognise the block
 * instantly and read only its colour and its badge. Giving each severity its
 * own composition would make the four states harder to tell apart, not easier,
 * because the eye would be comparing arrangements instead of a single signal.
 *
 * THE GROUND AND ITS HAIRLINE COME FROM `Card`'s `tone`, and no longer from a
 * local map. A tint and the pale edge that fences it are one decision — the
 * gallery is the surface every other screen is checked against, so a state
 * drawn here at a hairline strength no `Card` can produce would make the
 * catalogue disagree with the product it catalogues, in the exact direction
 * nobody thinks to check.
 *
 * THE 4px LEFT EDGE STAYS LOCAL, and that is the point of the split. It is the
 * SEVERITY axis (`--stroke-severity`) — the same edge `GateBanner` and the
 * failure banners wear — and `Card`'s `accent` is deliberately the other axis: a
 * 2px stripe on the TOP, meaning "this is the live block". Passing severity
 * through `accent` would redraw every banner in the catalogue on the wrong edge
 * and quietly redefine what the wrong edge means.
 *
 * BADGE AND BODY BOTH TAKE THE `-ink` VALUE, never the base state colour. This
 * is 9px bold uppercase text on a tint — the exact case where the design's own
 * pairing measures below AA (tokens.md), and `Chip` and `Button` already made
 * the same correction. The edge keeps the base colour: it is a 4px bar, not
 * text, so contrast ratios do not apply to it and the louder hue is what makes
 * severity readable at a glance down a column of cards.
 */
const SEVERITY_EDGE: Record<GalleryAccent, string> = {
  settled: "border-l-state-settled",
  halt: "border-l-state-halt",
  action: "border-l-action",
  attend: "border-l-state-attend",
};

const BODY_INK: Record<GalleryAccent, string> = {
  settled: "text-state-settled-ink",
  halt: "text-state-halt-ink",
  action: "text-action-ink",
  attend: "text-state-attend-ink",
};

export function StateSample({
  accent,
  badge,
  body,
}: {
  accent: GalleryAccent;
  badge: string;
  body: string;
}) {
  return (
    <Card
      size="nested"
      tone={accent}
      className={cn(
        "w-full border-l-(length:--stroke-severity) p-6",
        SEVERITY_EDGE[accent],
      )}
    >
      <Eyebrow variant="field" tone={accent} className="block">
        {badge}
      </Eyebrow>
      <p className={cn("mt-2 text-xs leading-body", BODY_INK[accent])}>{body}</p>
    </Card>
  );
}
