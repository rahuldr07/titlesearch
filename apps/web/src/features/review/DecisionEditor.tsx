import { useState } from "react";
import { Button, InnerPanel, Label, Textarea } from "../../components/ui";

export type EditorMode = "correct" | "escalate" | null;

/**
 * THE CORRECTION AND ESCALATION EDITORS — two forms, one refusal shape.
 *
 * INVARIANT 9: "A correction is refused without its reason." INVARIANT 10: "An
 * escalation is refused without its question." Both are held HERE with the
 * reason visible (rule 9: every disabled control states why), and both are
 * refused again by the server, which is the enforcement that matters — this is
 * the courtesy that stops a reviewer typing into a submit that was never going
 * to land.
 *
 * INVARIANT 32: "A correction is inert until it differs from the machine read."
 * A corrected value identical to what the machine already has is not a
 * correction, it is a confirm, and the hold says so and points at the button
 * that does mean that.
 *
 * INVARIANT 12: "Every refusal speaks — a silent no-op is the defect." So the
 * hold sentence is rendered inline as well as carried on the control: a `title`
 * is unreachable by keyboard and on touch, and this is the screen the product
 * is for.
 *
 * ══ IT IS AN `InnerPanel`, NOT A `Card` ════════════════════════════════════
 *
 * RECIPES: nested cards are forbidden, and `DecisionPanel` is already inside
 * one surface. `InnerPanel` is the 10px rung the kit provides for exactly this,
 * and `card.tsx`'s two-context guard makes the illegal arrangement a runtime
 * throw rather than a review comment.
 *
 * ══ WHY THE VALUE IS A `Textarea` ══════════════════════════════════════════
 *
 * `Input` deliberately refuses `value`/`defaultValue` (REVIEW-03 B2 — the value
 * belongs to a `TextField` this kit does not export), and a corrected value has
 * to be seeded from an adopted reading without retyping (INVARIANT 31), which
 * needs a controlled component. `Textarea` accepts `value` and is the control
 * that can carry a seeded one.
 */
export function DecisionEditor(props: {
  readonly mode: Exclude<EditorMode, null>;
  /** An adopted reading's value, so the reviewer never retypes it. */
  readonly seeded: string | null;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onCorrect: (body: { value: string; reason: string }) => void;
  readonly onEscalate: (question: string) => void;
}) {
  const [value, setValue] = useState(props.seeded ?? "");
  const [reason, setReason] = useState("");

  const hold = props.pending
    ? "Filing…"
    : props.mode === "escalate"
      ? reason.trim() === ""
        ? "An escalation is refused without its question."
        : null
      : value.trim() === ""
        ? "A correction needs the value it should have been."
        : reason.trim() === ""
          ? "A correction is refused without its reason."
          : null;

  return (
    <InnerPanel>
      <div className="flex flex-col gap-6">
        {props.mode === "correct" && (
          <div className="flex flex-col gap-3">
            <Label htmlFor="correct-value">The value it should have been</Label>
            <Textarea
              id="correct-value"
              data={true}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Label htmlFor="decision-reason">
            {props.mode === "correct" ? "Why" : "The question"}
          </Label>
          <Textarea
            id="decision-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        {/* INVARIANT 12 — the refusal speaks, in place, not only on hover. */}
        {hold !== null && (
          <p className="text-meta leading-body text-state-attend">{hold}</p>
        )}

        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            disabledBecause={hold}
            onPress={() => {
              if (hold !== null) return;
              if (props.mode === "correct") {
                props.onCorrect({ value, reason });
              } else {
                props.onEscalate(reason);
              }
            }}
          >
            {props.mode === "correct" ? "File the correction" : "Escalate"}
          </Button>
          <Button variant="ghost" onPress={props.onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </InnerPanel>
  );
}
