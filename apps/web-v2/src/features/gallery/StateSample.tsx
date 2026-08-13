import type { GalleryAccent } from "./galleryStates";
import { accentMark } from "./accentMarks";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * The banner every non-terminal state is drawn as: a tinted block, fenced by
 * the pale hairline of its own family.
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
 * THERE IS NO LEFT EDGE, AND REMOVING IT WAS A CORRECTION. The export draws
 * this block as a plain 1px hairline with all four corners rounded at 8px
 * (:2222); the heaviest left edge anywhere in the export is 3px, and
 * `grep -c 'border-left:4px'` returns zero. Every sample here wore a 4px
 * severity bar that squared its left corners — so the catalogue was checking
 * the product against a shape nothing ships, which is the one thing a
 * catalogue must never do. Severity now reads from the tint and the badge,
 * exactly as it does on the screens this documents.
 *
 * BADGE AND BODY BOTH TAKE THE `-ink` VALUE, never the base state colour. This
 * is 9px bold uppercase text on a tint — the exact case where the design's own
 * pairing measures below AA (tokens.md), and `Chip` and `Button` already made
 * the same correction.
 */
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
    <Card size="nested" tone={accent} className="w-full p-6">
      <Eyebrow variant="field" tone={accent} className="block">
        {/*
          THE MARK CARRIES THE REGISTER WHEN THE COLOUR CANNOT. Three of these
          four tints are within 1.16:1 of each other in greyscale (`tokens.css`
          header), so `Closed · added`, `Closed · amended` and `Note only` drew
          as one rectangle the moment colour came off — on the very surface every
          other screen is audited against. `accentMarks.ts` holds the glyphs and
          the reasoning; `accentMarks.test.ts` fails if two ever match.

          `aria-hidden` because the badge already NAMES its state in words. The
          glyph is the greyscale channel, not the accessible one — nothing here
          is announced twice.
        */}
        <span aria-hidden className="mr-1.5 not-italic">
          {accentMark(accent)}
        </span>
        {badge}
      </Eyebrow>
      <p className={cn("mt-2 text-xs leading-body", BODY_INK[accent])}>{body}</p>
    </Card>
  );
}
