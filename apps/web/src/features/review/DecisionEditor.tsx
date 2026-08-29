import { useState } from "react";
import type { NaReason } from "@titlepipe/contract";
import { Button, InnerPanel, Label, Textarea } from "../../components/ui";
import { AbsencePicker } from "./AbsencePicker";
import { REASON_LABEL, SUBMIT_LABEL, holdFor } from "./editorHold";

export type EditorMode = "correct" | "escalate" | "absence" | null;

/**
 * THE THREE EDITORS, ONE REFUSAL SHAPE. INVARIANT 9: "A correction is refused
 * without its reason." INVARIANT 10: "An escalation is refused without its
 * question." A Law 3 declaration is a correction on the wire
 * (`CorrectFieldRequest.na_reason`), so it is refused without BOTH the absence
 * and the reason.
 *
 * THE VALUE IS THE PARENT'S, THE REASON IS OURS, AND THAT SPLIT IS INVARIANT
 * 31. Adopting a reading has to land in an ALREADY-OPEN editor without
 * retyping — and the previous shape remounted this component on a `key` built
 * from the adopted value, which seeded the value and DESTROYED the reason the
 * reviewer had already typed. Measured: type a reason, adopt, reason is empty.
 * A controlled value has no remount, so the reason survives.
 */
export function DecisionEditor(props: {
  readonly mode: Exclude<EditorMode, null>;
  /** The value being filed. Owned above so an adopt can write it mid-edit. */
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** What the machine read. §11.1: a correction must CHANGE something. */
  readonly machineRead: string;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onCorrect: (body: { value: string; reason: string }) => void;
  readonly onEscalate: (question: string) => void;
  readonly onDeclareAbsence: (body: { na_reason: NaReason; reason: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [absence, setAbsence] = useState<NaReason | null>(null);

  const hold = holdFor({
    mode: props.mode,
    pending: props.pending,
    value: props.value,
    machineRead: props.machineRead,
    reason,
    absence,
  });

  return (
    <InnerPanel>
      {/* ESCAPE LEAVES THE EDITOR, and the chords resume on the very next
          keystroke because nothing was unbound (`shared/chords.ts`). Handled
          locally rather than through the overlay stack: this panel is inline,
          not a layer, so `useOverlays` has nothing to pop. */}
      <div
        className="flex flex-col gap-6"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          props.onCancel();
        }}
      >
        {props.mode === "correct" && (
          <div className="flex flex-col gap-3">
            <Label htmlFor="correct-value">The value it should have been</Label>
            <Textarea
              id="correct-value"
              data-testid="edit-value"
              /* `e` puts the caret in the field. Without it the chord opens an
                 editor the reviewer must then reach for with the mouse. */
              autoFocus
              data={true}
              value={props.value}
              onChange={(event) => props.onValueChange(event.target.value)}
            />
          </div>
        )}

        {props.mode === "absence" && (
          <AbsencePicker reason={absence} onPick={setAbsence} />
        )}

        <div className="flex flex-col gap-3">
          <Label htmlFor="decision-reason">{REASON_LABEL[props.mode]}</Label>
          <Textarea
            id="decision-reason"
            data-testid={props.mode === "escalate" ? "escalate-input" : "edit-reason"}
            autoFocus={props.mode !== "correct"}
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
            data-testid={props.mode === "escalate" ? "escalate-confirm" : "edit-submit"}
            disabledBecause={hold}
            onPress={() => {
              if (hold !== null) return;
              if (props.mode === "correct") {
                props.onCorrect({ value: props.value, reason });
              } else if (props.mode === "escalate") {
                props.onEscalate(reason);
              } else if (absence !== null) {
                props.onDeclareAbsence({ na_reason: absence, reason });
              }
            }}
          >
            {SUBMIT_LABEL[props.mode]}
          </Button>
          <Button variant="ghost" onPress={props.onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </InnerPanel>
  );
}
