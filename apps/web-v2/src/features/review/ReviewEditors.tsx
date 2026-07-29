import { CorrectEditor } from "./CorrectEditor";
import { EscalateEditor } from "./EscalateEditor";
import { ExcludeEditor } from "./ExcludeEditor";
import { PassControl } from "../../entities/order/PassControl";

export type ReviewMode = "idle" | "correct" | "escalate" | "exclude" | "pass";

interface ReviewEditorsProps {
  mode: ReviewMode;
  /** Keyed so adopting a different reading re-seeds the editor rather than keeping the old text. */
  editorKey: string;
  seed: string;
  /** The machine-read value a correction must differ from (§11.1). */
  machineValue: string;
  passPending: boolean;
  serverNote: string | null;
  blankNote: boolean;
  onCancel: () => void;
  onCorrect: (value: string, reason: string) => void;
  onEscalate: (question: string) => void;
  onExclude: (reason: string) => void;
  onPass: (reason: string) => void;
}

/**
 * Everything that opens UNDER the decision: the server's answer, the blank
 * refusal, and the three editors.
 *
 * ONE AT A TIME, by construction. Two open editors on one field is two drafts
 * of the same decision, and the reviewer who submits the wrong one has no way
 * to tell afterwards which they meant.
 *
 * THE SERVER'S MESSAGE IS SURFACED VERBATIM (`review-conflict.spec` ×2). A 409
 * is an ANSWER — "already confirmed with a different value" tells the reviewer
 * something true that they must act on — and paraphrasing it into "could not
 * save" would throw away the only part that matters.
 */
export function ReviewEditors({
  mode,
  editorKey,
  seed,
  machineValue,
  passPending,
  serverNote,
  blankNote,
  onCancel,
  onCorrect,
  onEscalate,
  onExclude,
  onPass,
}: ReviewEditorsProps) {
  return (
    <>
      {serverNote === null ? null : (
        <p
          data-testid="confirm-note"
          role="alert"
          className="text-xs font-semibold text-state-halt-ink"
        >
          server: {serverNote}
        </p>
      )}

      {blankNote ? (
        <p data-testid="nudge" role="alert" className="text-xs font-semibold text-state-halt-ink">
          nothing was extracted here — accepting an absence takes an explicit
          click, never a keystroke
        </p>
      ) : null}

      {mode === "correct" ? (
        <CorrectEditor
          key={editorKey}
          seed={seed}
          machineValue={machineValue}
          onCancel={onCancel}
          onSubmit={onCorrect}
        />
      ) : null}

      {mode === "escalate" ? (
        <EscalateEditor onCancel={onCancel} onSubmit={onEscalate} />
      ) : null}

      {mode === "exclude" ? (
        <ExcludeEditor onCancel={onCancel} onSubmit={onExclude} />
      ) : null}

      {mode === "pass" ? (
        <PassControl pending={passPending} onCancel={onCancel} onSubmit={onPass} />
      ) : null}
    </>
  );
}
