import type { Field } from "@titlepipe/contract";
import { canDo } from "@titlepipe/contract";
import { offersExclude } from "./excludeGate";
import { ReviewEditors, type ReviewMode } from "./ReviewEditors";
import { SourcePin } from "./SourcePin";
import type { Pinned } from "./useReviewEditor";
import { DecisionCard } from "../../entities/field/DecisionCard";
import { stateLabel } from "../../entities/field/fieldLabel";
import { useSession } from "../../shared/session";

interface DecisionColumnProps {
  field: Field;
  pinned: Pinned | null;
  mode: ReviewMode;
  seed: string;
  /** The machine-read value a correction must differ from (§11.1). */
  machineValue: string;
  writePending: boolean;
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
 * The decision, and whatever it opened — the review screen's wiring onto the
 * `entities/field` card.
 *
 * THE CARD IS THE ENTITY'S, NOT THIS FEATURE'S. Review carried its own
 * `DecisionPanel`, `DecisionActions` and `ReadingsPanel`, each a drifted copy of
 * a component that already existed one directory over — and the copies had lost
 * the export's own button wording along the way. What is left here is the only
 * part that is genuinely review's: which role may act, and where the editors go.
 *
 * THE ROLE GATE STAYS IN THE FEATURE. An entity that reads the session would
 * make every render of a field depend on who is looking, which is a decision
 * about this screen rather than a fact about a field. Actions are ABSENT for a
 * role that cannot act, never disabled: a greyed decision is an invitation to
 * ask for permission, an absent one is an answer.
 *
 * THE EDITORS LIVE INSIDE THE CARD rather than beside it, so the field they act
 * on is never off screen while somebody types a reason. A reason written about
 * the wrong field is worse than no reason.
 */
export function DecisionColumn({
  field,
  pinned,
  mode,
  seed,
  machineValue,
  writePending,
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
  const role = useSession((s) => s.role);
  const mayReview = canDo(role, "field.confirm");

  return (
    <DecisionCard
      field={field}
      statusLabel={stateLabel(field)}
      actions={
        mayReview
          ? {
              // R13, from the one predicate the `x` chord reads too.
              offerExclude: offersExclude(field.path),
              onConfirm,
              onCorrect,
              onEscalate: () => onMode("escalate"),
              onExclude: () => onMode("exclude"),
              onPass: () => onMode("pass"),
            }
          : null
      }
      readings={{
        onAdopt,
        onPin: (reading, seat) => onPin({ seat, reading }),
        pin:
          pinned === null ? null : (
            <SourcePin
              seat={pinned.seat}
              engineId={pinned.reading.engine_id}
              page={pinned.reading.page}
              coords={pinned.reading.line_coords}
            />
          ),
      }}
    >
      <ReviewEditors
        mode={mode}
        editorKey={`${field.id}:${seed}`}
        seed={seed}
        machineValue={machineValue}
        writePending={writePending}
        serverNote={serverNote}
        blankNote={blankNote}
        onCancel={() => onMode("idle")}
        onCorrect={onCorrectSubmit}
        onEscalate={onEscalateSubmit}
        onExclude={onExcludeSubmit}
        onPass={onPassSubmit}
      />
    </DecisionCard>
  );
}
