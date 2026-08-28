import type { CaptureScheduleResponse } from "@titlepipe/contract";
import { Button, Card, CardBody, CardHeader } from "../../components/ui";
import { SheetRow } from "./SheetRow";
import { holdReason, type DraftSheet, type DraftEntry } from "./draftEntry";

export function CaptureSheet(props: {
  readonly schedule: CaptureScheduleResponse;
  readonly sheet: DraftSheet;
  readonly onChange: (next: DraftEntry) => void;
  readonly answered: readonly DraftEntry[];
  readonly missingRequired: readonly string[];
  readonly pending: boolean;
  readonly onFile: () => void;
}) {
  const held = holdReason(props.answered, props.missingRequired);
  // Row testids number across the whole sheet, not per section.
  const position = new Map(
    props.schedule.sections.flatMap((s) => s.fields).map((f, i) => [f.path, i] as const),
  );

  return (
    <Card padding="none" className="w-full max-w-360">
      <div className="flex flex-col items-center gap-3 border-b border-line-strong px-11 py-14 text-center">
        <h2 className="font-sans text-body leading-tight font-bold text-ink-primary">
          Abstractor call back sheet
        </h2>
        <p className="font-mono text-label leading-flat text-ink-muted">
          Package{" "}
          <span data-testid="capture-order">{props.schedule.order_id}</span> ·{" "}
          {props.schedule.pages} pages · seat {props.schedule.seat}
        </p>
      </div>

      {props.schedule.sections.map((section) => (
        <section key={section.id} data-testid={`sheet-section-${section.id}`}>
          <CardHeader>{section.title}</CardHeader>
          <ul>
            {section.fields.map((field) => {
              const draft = props.sheet[field.path];
              if (draft === undefined) return null;
              return (
                <SheetRow
                  key={field.path}
                  field={field}
                  draft={draft}
                  index={position.get(field.path) ?? 0}
                  onChange={props.onChange}
                />
              );
            })}
          </ul>
        </section>
      ))}

      <CardBody className="flex flex-wrap items-center justify-between gap-6 border-t border-line-strong">
        <p className="font-sans text-meta leading-body text-ink-secondary">
          {held ?? "Every keyed row carries a source and a stated confidence."}
        </p>
        <Button
          variant="primary"
          data-testid="capture-file"
          disabledBecause={
            props.pending ? "Sending — the server has not answered yet." : held ?? undefined
          }
          onPress={props.onFile}
        >
          {held === null ? "File this sheet" : "File this sheet — held"}
        </Button>
      </CardBody>
    </Card>
  );
}
