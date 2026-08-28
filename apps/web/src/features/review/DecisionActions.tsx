import { Button } from "../../components/ui";
import type { EditorMode } from "./DecisionEditor";

/**
 * FOUR ACTS ON THE OPEN DECISION, and the fourth is the one that was missing.
 *
 * Confirm · Correct · Declare an absence · Escalate. The design draws the
 * absence branch as a separate "Law 3 Protocol" grid shown INSTEAD of confirm
 * and edit; nothing on the wire says which fields are absence-only, and
 * `enums.ts:44-48` forbids deriving it from `value === null`, so it is a peer
 * act rather than a mode this screen decides for the reviewer.
 *
 * `disabledBecause`, not `isDisabled` — the kit has no boolean disable,
 * because rule 9 says every blocked control states its reason. The type
 * refuses the shortcut, which is the point.
 */
export function DecisionActions(props: {
  readonly pending: boolean;
  readonly onConfirm: () => void;
  readonly onOpen: (mode: Exclude<EditorMode, null>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button
        variant="primary"
        data-testid="act-confirm"
        disabledBecause={props.pending ? "Filing the last act…" : null}
        onPress={props.onConfirm}
      >
        Confirm
      </Button>
      <Button
        variant="secondary"
        data-testid="act-correct"
        onPress={() => props.onOpen("correct")}
      >
        Correct
      </Button>
      <Button
        variant="secondary"
        data-testid="act-absence"
        onPress={() => props.onOpen("absence")}
      >
        Declare an absence
      </Button>
      <Button
        variant="ghost"
        data-testid="act-escalate"
        onPress={() => props.onOpen("escalate")}
      >
        Escalate
      </Button>
    </div>
  );
}
