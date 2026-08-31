import { Button } from "../../components/ui";
import type { EditorMode } from "./DecisionEditor";

/**
 * Four acts on the open decision: Confirm · Correct · Declare an absence ·
 * Escalate. The absence branch is a peer act rather than a mode this screen
 * decides for the reviewer — nothing on the wire says which fields are
 * absence-only. `disabledBecause`, not `isDisabled`: every blocked control
 * states its reason, and the type refuses the shortcut.
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
