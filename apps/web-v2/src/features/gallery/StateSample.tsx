import type { GalleryAccent } from "./galleryStates";
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
 * The 4px left edge is the severity axis (`--stroke-severity`), the same one
 * `Card`'s accent uses. Keeping it identical is what lets a banner inside a
 * card and a banner on its own read as the same statement.
 *
 * BADGE AND BODY BOTH TAKE THE `-ink` VALUE, never the base state colour. This
 * is 9px bold uppercase text on a tint — the exact case where the design's own
 * pairing measures below AA (tokens.md), and `Chip` and `Button` already made
 * the same correction. The edge keeps the base colour: it is a 4px bar, not
 * text, so contrast ratios do not apply to it and the louder hue is what makes
 * severity readable at a glance down a column of cards.
 */
const BLOCK: Record<GalleryAccent, string> = {
  settled: "bg-state-settled-surface border-state-settled-border border-l-state-settled",
  halt: "bg-state-halt-surface border-state-halt-border border-l-state-halt",
  action: "bg-action-surface border-action-border border-l-action",
  attend: "bg-state-attend-surface border-state-attend-border border-l-state-attend",
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
    <div
      className={cn(
        "w-full rounded-7 border border-l-(length:--stroke-severity) p-6",
        BLOCK[accent],
      )}
    >
      <Eyebrow variant="field" tone={accent} className="block">
        {badge}
      </Eyebrow>
      <p className={cn("mt-2 text-xs leading-body", BODY_INK[accent])}>{body}</p>
    </div>
  );
}
