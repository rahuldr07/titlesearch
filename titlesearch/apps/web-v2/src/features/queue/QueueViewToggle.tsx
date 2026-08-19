import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";

export type QueueView = "reviewer" | "senior";

/**
 * The mockup's `.toggle button`: 4px radius, `6px 14px`, and — pressed — the
 * BRIGHTEST paper lifted on `--sh-1`, in primary ink at 600.
 *
 * RULE: the sealing wax is spent once per screen, on the one action. FAILURE
 * PREVENTED: the pressed segment was `text-action`, so the queue's view
 * preference was drawn in the same red as "Take next order" and the eye had two
 * red things to rank. The mockup marks the pressed segment by RAISING it — a
 * bright chip standing off a sunken track — which is a depth signal, and depth
 * is what this palette separates with (Card.tsx). It survives greyscale too,
 * which a colour swap on an 11px word does not.
 */
const SEGMENT = [
  "rounded-4 border-transparent bg-transparent px-7 py-3 text-sm text-ink-secondary",
  "data-pressed:border-transparent data-pressed:bg-surface-raised",
  "data-pressed:font-semibold data-pressed:text-ink-primary data-pressed:shadow-card",
].join(" ");

/**
 * ONE CONTROL WITH TWO POSITIONS, not two buttons.
 *
 * RULE: the design has two selection languages and both are real. FAILURE
 * PREVENTED: drawn with the kit's default fill-swap pill, this read as a navy
 * primary beside a white secondary — a view preference shouting louder than the
 * "Take next order" primary below it, which is the actual decision on the page.
 * The export draws a segmented track here (`--ground` fill, 1px rule, 7px
 * radius, 3px inner padding, 2px gap) with the active segment a `--panel` fill
 * in violet ink, and keeps the fill swap for the sixteen filter chips —
 * Overview's Board/Rail among them. Both patterns stay selectable.
 *
 * RULE: this is a VIEW, never an identity (§4.4, conflict C12). FAILURE
 * PREVENTED: nothing here changes who you are or what you may open. It shows
 * and hides the In flight band exactly as the export does; the session still
 * carries the role and the server still gates every byte behind it. Which is
 * why it is a toggle group and not a role picker, and why it cannot reveal a
 * band the server declined to send.
 */
export function QueueViewToggle({
  view,
  onView,
}: {
  view: QueueView;
  onView: (view: QueueView) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Queue view"
      /* `.toggle` — 7px track (`--radius-7` is named for exactly this), 3px of
         inner padding, 2px between cells, on the SUNKEN paper the mockup uses
         for a track. `surface-app` was the desk, not a track, so the control had
         no well for its pressed chip to sit in. */
      className="gap-1 rounded-7 border border-line-strong bg-surface-sunken p-1.5"
      value={[view]}
      onValueChange={(values) => {
        const picked = values.at(0);
        if (picked === "reviewer" || picked === "senior") onView(picked);
      }}
    >
      <Toggle value="reviewer" className={SEGMENT}>
        Reviewer
      </Toggle>
      <Toggle value="senior" className={SEGMENT}>
        Senior · Ops
      </Toggle>
    </ToggleGroup>
  );
}
