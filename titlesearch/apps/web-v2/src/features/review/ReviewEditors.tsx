import { CorrectEditor } from "./CorrectEditor";
import { CONFIRM_CONTROL_ID } from "../../entities/field/DecisionBar";
import { EscalateEditor } from "./EscalateEditor";
import { ExcludeEditor } from "./ExcludeEditor";
import { PassControl } from "../../entities/order/PassControl";
import { RefusalNudge } from "../../shared/ui/RefusalNudge";

export type ReviewMode = "idle" | "correct" | "escalate" | "exclude" | "pass";

interface ReviewEditorsProps {
  mode: ReviewMode;
  /** Keyed so adopting a different reading re-seeds the editor rather than keeping the old text. */
  editorKey: string;
  seed: string;
  /** The machine-read value a correction must differ from (§11.1). */
  machineValue: string;
  /**
   * A DECISION WRITE IS IN FLIGHT. One flag for all four editors, because
   * exactly one is open at a time and the mutation it fires is the only one
   * that can be pending underneath it. It was `passPending` and reached the
   * pass control alone, which is why every other submit could be fired twice.
   */
  writePending: boolean;
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
 * save" would throw away the only part that matters. It stays a hand-spelled
 * line rather than a `RefusalNudge`: the server refusing a submission and the
 * client refusing to send one are different claims, and `confirm-note` is the
 * testid the conflict specs select on.
 *
 * THE BLANK REFUSAL IS ABOUT THE CONFIRM BUTTON, and now says so — it is raised
 * by the `c` key and answered only by clicking that control, so the description
 * belongs on it. `RefusalNudge` binds `aria-describedby` to
 * `CONFIRM_CONTROL_ID` on mount; a keyboard user who presses `c` on an empty
 * field previously got a line that never reached the control they had to reach
 * for next.
 */
export function ReviewEditors({
  mode,
  editorKey,
  seed,
  machineValue,
  writePending,
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
        <RefusalNudge
          controlId={CONFIRM_CONTROL_ID}
          message="nothing was extracted here — accepting an absence takes an explicit click, never a keystroke"
        />
      ) : null}

      {mode === "correct" ? (
        <CorrectEditor
          key={editorKey}
          seed={seed}
          machineValue={machineValue}
          pending={writePending}
          onCancel={onCancel}
          onSubmit={onCorrect}
        />
      ) : null}

      {mode === "escalate" ? (
        <EscalateEditor pending={writePending} onCancel={onCancel} onSubmit={onEscalate} />
      ) : null}

      {mode === "exclude" ? (
        <ExcludeEditor pending={writePending} onCancel={onCancel} onSubmit={onExclude} />
      ) : null}

      {mode === "pass" ? (
        <PassControl pending={writePending} onCancel={onCancel} onSubmit={onPass} />
      ) : null}
    </>
  );
}
