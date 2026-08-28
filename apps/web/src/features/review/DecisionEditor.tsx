import { useState } from "react";
import { Button, InnerPanel, Label, Textarea } from "../../components/ui";

export type EditorMode = "correct" | "escalate" | null;

/**

 * THE CORRECTION AND ESCALATION EDITORS — two forms, one refusal shape. INVARIANT 9:

 * "A correction is refused without its reason." INVARIANT 10: "An escalation is

 * refused without its question." Both are held HERE with the reason visible…

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
