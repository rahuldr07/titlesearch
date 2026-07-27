import type { BlindEntry, BlindField } from "./roster";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * The two NON-INTERACTIVE renders of a capture field, split out because
 * `FieldCapture` was doing three unrelated jobs in one file and the line gate
 * said so.
 *
 * Both keep the `field-{id}` testid: from the outside a field is one thing
 * whatever state it is in, and the harvested specs address it that way.
 */

/** Already recorded in this session. Shows what THIS typist entered — never pipeline output. */
export function SettledField({
  field,
  entry,
}: {
  field: BlindField;
  entry: BlindEntry;
}) {
  return (
    <Card size="nested" data-testid={`field-${field.id}`}>
      <CardBody>
        <Eyebrow variant="field">{field.label}</Eyebrow>
        <p
          data-testid={`settled-${field.id}`}
          className="mt-2 font-mono text-md text-ink-primary"
        >
          {entry.na_reason ?? entry.value}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {entry.source_citation} · {entry.confidence}
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * Waiting on its section's TYPE. Says WHY it is closed rather than simply
 * appearing inert — a control with no explanation reads as broken.
 */
export function GatedField({ field, note }: { field: BlindField; note: string }) {
  return (
    <Card size="nested" data-testid={`field-${field.id}`}>
      <CardBody>
        <Eyebrow variant="field" tone="muted">{field.label}</Eyebrow>
        <p className="mt-2 text-base text-ink-secondary">{note}</p>
      </CardBody>
    </Card>
  );
}
