import type { Field } from "@titlepipe/contract";
import { DecisionPanel, type Pinned } from "./DecisionPanel";
import { ReviewEditors, type ReviewMode } from "./ReviewEditors";

interface DecisionColumnProps {
  field: Field;
  pinned: Pinned | null;
  mode: ReviewMode;
  seed: string;
  passPending: boolean;
  serverNote: string | null;
  blankNote: boolean;
  onPin: (pinned: Pinned) => void;
  onAdopt: (value: string) => void;
  onConfirm: () => void;
  onCorrect: () => void;
  onMode: (mode: ReviewMode) => void;
  onCorrectSubmit: (value: string, reason: string) => void;
  onEscalateSubmit: (question: string) => void;
  onExcludeSubmit: (reason: string) => void;
  onPassSubmit: (reason: string) => void;
}

/**
 * The middle pane: the decision, and whatever it opened.
 *
 * The editors live INSIDE the panel rather than beside it so the field they act
 * on is never off screen while somebody types a reason. A reason written about
 * the wrong field is worse than no reason, and the only defence that costs
 * nothing is keeping the two in one column.
 */
export function DecisionColumn({
  field,
  pinned,
  mode,
  seed,
  passPending,
  serverNote,
  blankNote,
  onPin,
  onAdopt,
  onConfirm,
  onCorrect,
  onMode,
  onCorrectSubmit,
  onEscalateSubmit,
  onExcludeSubmit,
  onPassSubmit,
}: DecisionColumnProps) {
  return (
    <DecisionPanel
      field={field}
      pinned={pinned}
      onPin={onPin}
      onAdopt={onAdopt}
      onConfirm={onConfirm}
      onCorrect={onCorrect}
      onEscalate={() => onMode("escalate")}
      onExclude={() => onMode("exclude")}
      onPass={() => onMode("pass")}
    >
      <ReviewEditors
        mode={mode}
        editorKey={`${field.id}:${seed}`}
        seed={seed}
        passPending={passPending}
        serverNote={serverNote}
        blankNote={blankNote}
        onCancel={() => onMode("idle")}
        onCorrect={onCorrectSubmit}
        onEscalate={onEscalateSubmit}
        onExclude={onExcludeSubmit}
        onPass={onPassSubmit}
      />
    </DecisionPanel>
  );
}
