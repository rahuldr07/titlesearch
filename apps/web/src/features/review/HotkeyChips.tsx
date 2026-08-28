import { Kbd } from "../../components/ui";

/**
 * THE HOTKEY CHIPS — design §Screens 7's "C/E/Q/J-K/Z".
 *
 * Five chords, printed where the work is, because keyboard IS the navigation
 * layer here (INVARIANT 54) and a chord nobody can see is a chord nobody uses.
 * `?` renders the full map; this is the working subset that stays on screen.
 *
 * ══ WHAT THIS STRIP IS NOT ═════════════════════════════════════════════════
 *
 * It is a LEGEND, not a control. Every chip is a `<span>` and none of them
 * fires the action it names. INVARIANT 53 states the trap directly — "a cheat
 * sheet that fires the commands it describes is the trap it claims not to be" —
 * and while that rule is written about the key map dialog, a clickable legend
 * on the screen itself is the same failure with a shorter path: a reviewer aims
 * for the chip explaining `q` and escalates a field.
 *
 * The actions are on the decision card, where the field being acted on is
 * visible. That is the whole argument: an action needs its subject in view.
 *
 * ══ WHY `X` AND `P` ARE NOT DRAWN HERE ═════════════════════════════════════
 *
 * The design names five, so five are drawn. `x` (suppress, R13) is offered only
 * on judgment rows and belongs beside the button that is conditionally there —
 * a permanent chip for a conditional chord teaches a key that mostly does
 * nothing. `p` (pass) is an ORDER-level act, not a field-level one, and lives
 * with the order header for the same reason.
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
