import { useRef, useState } from "react";
import { Button } from "./Button";

/**
 * Arm, then confirm — INLINE, not a modal.
 *
 * `component-inventory.md` §1 records the decision: *"Design uses inline
 * arm-then-confirm; keep inline, borrow focus semantics."* So this is not an
 * `alert-dialog`. The design never interrupts the page to ask, and a modal here
 * would be a pattern the product does not otherwise use.
 *
 * "Borrow focus semantics" is the part that matters and is easy to skip: when
 * the control arms, focus MOVES to the confirm button. Without that, a keyboard
 * user presses the trigger and focus stays on a button whose label has silently
 * changed underneath them — they cannot tell the state changed, and the next
 * Enter does something they did not read. The `role="alert"` question is
 * announced for the same reason.
 *
 * Solid red is reserved for exactly this: it is the only solid-red button in
 * the design, and it appears only on the confirming half of a two-step act.
 */
export function DestructiveConfirm({
  trigger,
  question,
  confirmLabel,
  onConfirm,
}: {
  /** The resting label — "Retire…", the ellipsis signalling a second step. */
  trigger: string;
  /** What is about to happen, stated plainly. */
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  if (!armed) {
    return (
      <Button
        size="sm"
        fill="outlined"
        tone="halt"
        onClick={() => {
          setArmed(true);
          // Focus follows the state change, on the next frame so the button exists.
          requestAnimationFrame(() => confirmRef.current?.focus());
        }}
      >
        {trigger}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <p role="alert" className="text-xs font-semibold text-state-halt-ink">
        {question}
      </p>
      <Button ref={confirmRef} size="sm" tone="halt" onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button size="sm" fill="outlined" tone="neutral" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </div>
  );
}
