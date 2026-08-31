import { useState } from "react";
import type { Field } from "@titlepipe/contract";
import { Alert, Card } from "../../components/ui";
import { DecisionCard } from "../../entities/decision/DecisionCard";
import { nominatedPair } from "./readings";
import { fieldLabel } from "./fieldNaming";
import { panelRubric } from "./panelRubric";
import { confirmValue, readCited } from "../../shared/provenance";
import { useReviewWrites } from "./useReviewWrites";
import { DecisionActions } from "./DecisionActions";
import { DecisionEditor, type EditorMode } from "./DecisionEditor";
import { ExcerptStrip } from "./ExcerptStrip";
import { useDecisionKeys } from "./useReviewKeys";

/**
 * The open decision — the workstation's subject. `DecisionCard`
 * (`entities/decision`) draws the row; the acts are composed here because
 * the feature owns the chords. Four acts, not three: confirm, correct,
 * escalate — and declare an absence (`AbsencePicker`), without which the
 * four NA reasons would be readable but unwritable. The consequence line
 * and the excerpt are the server's sentences, passed straight through: a
 * claim about what a wrong answer costs is the rulebook's to make, and the
 * split of an excerpt at its match is the engine's.
 */
export function DecisionPanel(props: {
  readonly field: Field | null;
  readonly orderId: string;
  /** The excerpt's door to the sheet, which lives across the split. */
  readonly onViewPage: (page: number) => void;
}) {
  const writes = useReviewWrites(props.orderId);
  const [mode, setMode] = useState<EditorMode>(null);
  /* The value being filed. Held here so an adopt can write into an editor
     that is already open without remounting it. */
  const [value, setValue] = useState("");

  const field = props.field;
  const machineRead = field === null ? null : confirmValue(field);

  const open = (next: Exclude<EditorMode, null>, seed?: string) => {
    if (seed !== undefined) setValue(seed);
    setMode(next);
  };

  const close = () => {
    setMode(null);
    setValue("");
  };

  useDecisionKeys({
    enabled: field !== null && mode === null,
    /*
     * The confirm chord never accepts a blank: a field the server sent no
     * value for is settled by declaring which absence it is, and a held-down
     * `c` must not bulk-accept absences. The button still files it — a click
     * is an explicit act, which is the whole distinction.
     */
    onConfirm: () => {
      if (field !== null && machineRead !== null) writes.confirm(field.id, machineRead);
    },
    onCorrect: () => open("correct", machineRead ?? ""),
    onEscalate: () => open("escalate"),
  });

  if (field === null) {
    return (
      <div className="shrink-0 border-b border-line-strong bg-surface-app p-8">
        <Card>
          <p className="text-meta leading-body text-ink-secondary">
            No field is open. The queue in the middle column holds what the server
            flagged; choosing one opens it here beside its source page.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col gap-6 border-b border-line-strong bg-surface-app p-8">
      <DecisionCard
        field={field}
        label={fieldLabel(field.path)}
        consequence={field.consequence}
        rubric={panelRubric(field, readCited(field)).text}
        readings={nominatedPair(field.readings ?? []) ?? undefined}
        onAdoptReading={(reading) => {
          // Into the editor, never retyped — and into one that is already
          // open without discarding what has been typed beside it.
          open("correct", reading.value ?? ""); // rules-allow: FieldReading.value, not Field.value — a pre-merge reading has no provenance union to read through
        }}
        actions={
          <DecisionActions
            pending={writes.pending}
            onConfirm={() => writes.confirm(field.id, machineRead)}
            onOpen={(next) => open(next, next === "correct" ? (machineRead ?? "") : "")}
          />
        }
      />

      {/* The quoted line with the read marked in it. Absent where no reader
          typed an excerpt; null where one arrived without match offsets. */}
      {field.source_excerpt !== null && field.source_excerpt !== undefined && (
        <ExcerptStrip
          excerpt={field.source_excerpt}
          onView={props.onViewPage}
        />
      )}

      {/*
       * The server's last word, held rather than flashed. `Alert`'s `message`
       * is a plain string slot, so nothing can be composed into the sentence.
       */}
      {writes.serverNote !== null && (
        <div data-testid="confirm-note">
          <Alert tone="halt" title="The server answered" message={writes.serverNote} />
        </div>
      )}

      {mode !== null && (
        <DecisionEditor
          key={field.id}
          mode={mode}
          value={value}
          onValueChange={setValue}
          machineRead={machineRead ?? ""}
          pending={writes.pending}
          onCancel={() => {
            close();
            writes.clearNote();
          }}
          onCorrect={(body) => writes.correct(field.id, body, close)}
          onEscalate={(question) => writes.escalate(field.id, question, close)}
          onDeclareAbsence={(body) =>
            writes.correct(field.id, { ...body, value: null }, close)
          }
        />
      )}
    </div>
  );
}
