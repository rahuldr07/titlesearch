import { useState } from "react";
import type { BlindEntry, BlindField } from "./roster";
import { SettledField, GatedField } from "./FieldStates";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";
import { Button } from "../../shared/ui/Button";
import { Chip } from "../../shared/ui/Chip";

/**
 * One field's three-part contract: a value (or UNREADABLE), a source, and a
 * confidence. Record is refused until all three exist — `blind.spec` #3 walks
 * exactly that, checking the button is ABSENT after each partial step.
 *
 * "UNCLEAR WITH A SOURCE IS THE JOB DONE." `blind.spec` #4 makes it an
 * invariant, and it is the most important idea on this screen: a typist who
 * cannot read a stamp should say so and cite the page, not guess and mark it
 * certain. A guess marked certain corrupts the seed set permanently; an
 * unclear-with-a-source is a usable answer.
 *
 * There is no engine, no model, no suggestion and no other typist here. Not by
 * policy — the screen has nothing to show.
 */
export function FieldCapture({
  field,
  settled,
  onRecord,
  disabled,
  disabledNote,
  recordBlocked = false,
}: {
  field: BlindField;
  settled?: BlindEntry | undefined;
  onRecord: (entry: BlindEntry) => void;
  disabled?: boolean;
  disabledNote?: string | undefined;
  /** TYPE fields: Record stays absent until the second pass is confirmed. */
  recordBlocked?: boolean;
}) {
  const [value, setValue] = useState("");
  const [unreadable, setUnreadable] = useState(false);
  const [source, setSource] = useState("");
  const [confidence, setConfidence] = useState<"certain" | "unclear" | null>(null);

  if (settled) return <SettledField field={field} entry={settled} />;
  if (disabled) return <GatedField field={field} note={disabledNote ?? ""} />;

  const answered = unreadable || value.trim() !== "";
  const complete = answered && source.trim() !== "" && confidence !== null;

  return (
    <Card size="nested" data-testid={`field-${field.id}`}>
      <CardBody className="flex flex-col gap-4">
        <Eyebrow variant="field">{field.label}</Eyebrow>

        <div className="flex flex-wrap items-center gap-4">
          <TextField
            data-testid={`value-${field.id}`}
            value={unreadable ? "" : value}
            disabled={unreadable}
            placeholder="what the page says"
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            size="sm"
            fill={unreadable ? "solid" : "outlined"}
            tone={unreadable ? "halt" : "neutral"}
            onClick={() => setUnreadable((v) => !v)}
          >
            UNREADABLE
          </Button>
        </div>

        <TextField
          data-testid={`source-${field.id}`}
          value={source}
          placeholder="which document and page did you read?"
          onChange={(e) => setSource(e.target.value)}
        />

        <div className="flex flex-wrap items-center gap-4">
          <Eyebrow variant="caption">How sure?</Eyebrow>
          <Button
            size="sm"
            data-testid={`conf-certain-${field.id}`}
            fill={confidence === "certain" ? "solid" : "outlined"}
            tone={confidence === "certain" ? "settled" : "neutral"}
            onClick={() => setConfidence("certain")}
          >
            certain
          </Button>
          <Button
            size="sm"
            data-testid={`conf-unclear-${field.id}`}
            fill={confidence === "unclear" ? "solid" : "outlined"}
            tone={confidence === "unclear" ? "attend" : "neutral"}
            onClick={() => setConfidence("unclear")}
          >
            unclear
          </Button>
          <Chip tone="neutral" size="micro">
            unclear + a source is the job done
          </Chip>
        </div>

        {complete && !recordBlocked ? (
          <div>
            <Button
              size="sm"
              data-testid={`record-${field.id}`}
              onClick={() =>
                onRecord({
                  path: field.id,
                  value: unreadable ? null : value.trim(),
                  na_reason: unreadable ? "PRESENT_UNREADABLE" : null,
                  source_citation: source.trim(),
                  confidence: confidence,
                })
              }
            >
              Record field
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
