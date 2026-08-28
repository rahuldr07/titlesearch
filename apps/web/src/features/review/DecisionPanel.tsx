import { useState } from "react";
import type { Field } from "@titlepipe/contract";
import { Alert, Button, Card } from "../../components/ui";
import { DecisionCard } from "../../entities/decision/DecisionCard";
import { nominatedPair } from "./readings";
import { fieldLabel } from "./fieldNaming";
import { panelRubric } from "./panelRubric";
import { readCited } from "../../shared/provenance";
import { useReviewWrites } from "./useReviewWrites";
import { DecisionEditor, type EditorMode } from "./DecisionEditor";

/**

 * THE OPEN DECISION — the workstation's subject, and the one place rule 1's accent is

 * spent on this screen. `DecisionCard` (`entities/decision`) already draws RECIPES'

 * "Open decision" row exactly as specified — a 3px left rail and NO fill…

 */
export function DecisionPanel(props: {
  readonly field: Field | null;
  readonly orderId: string;
}) {
  const writes = useReviewWrites(props.orderId);
  const [mode, setMode] = useState<EditorMode>(null);
  const [adopted, setAdopted] = useState<string | null>(null);

  if (props.field === null) {
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

  const field = props.field;

  return (
    <div className="flex shrink-0 flex-col gap-6 border-b border-line-strong bg-surface-app p-8">
      {/* `label`/`rubric` are passed in: an entity may not import a feature,
          and these are what the specs address the selection by (sel-label,
          sel-state — eighty assertions). `panelRubric` was orphaned until now;
          StatePill says "Needs review" where the rubric says "NEEDS REVIEW",
          and the specs pin the second. See CONFLICT-caps-in-strings.md. */}
      <DecisionCard
        field={field}
        label={fieldLabel(field.path)}
        rubric={panelRubric(field, readCited(field)).text}
        readings={nominatedPair(field.readings ?? []) ?? undefined}
        onAdoptReading={(reading) => {
          // INVARIANT 31 — into the editor, never retyped.
          setAdopted(reading.value); // rules-allow: FieldReading.value, not Field.value — a pre-merge reading has no provenance union to read through
          setMode("correct");
        }}
        actions={
          <div className="flex flex-wrap items-center gap-4">
            {/*
             * `disabledBecause`, not `isDisabled` — the kit has no boolean
             * disable, because rule 9 says every blocked control states its
             * reason. The type refuses the shortcut, which is the point.
             */}
            <Button
              variant="primary"
              disabledBecause={writes.pending ? "Filing the last act…" : null}
              onPress={() => writes.confirm(field.id, null)}
            >
              Confirm
            </Button>
            <Button variant="secondary" onPress={() => setMode("correct")}>
              Correct
            </Button>
            <Button variant="ghost" onPress={() => setMode("escalate")}>
              Escalate
            </Button>
          </div>
        }
      />

      {/*
       * The server's last word, held rather than flashed. `Alert`'s `message`
       * is a plain string slot, so nothing can be composed into the sentence.
       */}
      {writes.serverNote !== null && (
        <Alert tone="halt" title="The server answered" message={writes.serverNote} />
      )}

      {mode !== null && (
        <DecisionEditor
          mode={mode}
          seeded={adopted}
          pending={writes.pending}
          onCancel={() => {
            setMode(null);
            setAdopted(null);
            writes.clearNote();
          }}
          onCorrect={(body) =>
            writes.correct(field.id, body, () => {
              setMode(null);
              setAdopted(null);
            })
          }
          onEscalate={(question) =>
            writes.escalate(field.id, question, () => setMode(null))
          }
        />
      )}
    </div>
  );
}
