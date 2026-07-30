import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";

export type QueueView = "reviewer" | "senior";

/** The export's segment: 5px radius, 12/7px padding, panel fill in violet ink. */
const SEGMENT = [
  "rounded-4 border-transparent bg-transparent px-6 py-3.5 text-sm text-ink-secondary",
  "data-pressed:border-transparent data-pressed:bg-surface-panel data-pressed:text-action",
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
      className="gap-1 rounded-6 border border-line-strong bg-surface-app p-1.5"
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
