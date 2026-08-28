import { Kbd } from "../../components/ui";

/**

 * THE HOTKEY CHIPS — design §Screens 7's "C/E/Q/J-K/Z". Five chords, printed where the

 * work is, because keyboard IS the navigation layer here (INVARIANT 54) and a chord

 * nobody can see is a chord nobody uses.

 */
const CHORDS: readonly { key: string; means: string }[] = [
  { key: "C", means: "Confirm" },
  { key: "E", means: "Correct" },
  { key: "Q", means: "Escalate" },
  { key: "J / K", means: "Next / previous" },
  { key: "Z", means: "Zoom to citation" },
];

export function HotkeyChips() {
  return (
    <div
      data-testid="hotkey-chips"
      // Not a `role="list"`: a legend is prose furniture, and announcing five
      // list items to a screen reader on every pane entry is noise. The full
      // map behind `?` is the accessible surface for this information.
      className="flex flex-wrap items-center gap-4 border-b border-line-strong px-10 py-6"
    >
      {CHORDS.map((chord) => (
        <span key={chord.key} className="flex items-center gap-2">
          <Kbd>{chord.key}</Kbd>
          <span className="font-sans text-label leading-flat text-ink-muted">
            {chord.means}
          </span>
        </span>
      ))}
    </div>
  );
}
