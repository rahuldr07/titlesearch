import type { Field } from "@titlepipe/contract";
import { FieldRow } from "./FieldRow";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { EmptyNote } from "../../shared/ui/EmptyPanel";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { DividedSection } from "../../shared/ui/ListRow";

/**
 * THE DECISION QUEUE LEADS; everything already settled sits under it.
 *
 * The design puts the fields that need a person at the top and collapses the
 * rest, and the split is the whole point. A flat list of every field carries
 * the same information as the draft sheet directly below it, so the screen
 * reads as two copies of one thing — and the seven decisions get buried among
 * the twenty facts.
 *
 * SETTLED FIELDS STAY LISTED, not hidden. A reviewer has to be able to look at
 * an auto-confirmed value, because that is how a bad threshold gets noticed.
 * Only the queued rows are walkable by keyboard (`review.spec` #9), so looking
 * stays looking rather than turning into re-deciding.
 *
 * AN EMPTY QUEUE IS RESOLVED, NOT UNLOADED — `EmptyNote`, never a bare
 * sentence styled like a row. `fields` has already come back from the server by
 * the time this renders (`ReviewScreen` stands `ScreenMessage` in its place
 * until then), so "every decision is answered" is a statement about the work
 * rather than a guess about the request.
 */
export function FieldList({
  fields,
  selectedPath,
  onSelect,
}: {
  fields: readonly Field[];
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const queued = fields.filter((field) => field.state === "needs_review");
  const settled = fields.filter((field) => field.state !== "needs_review");

  const rows = (group: readonly Field[]) => (
    <DividedSection>
      {group.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          selected={field.path === selectedPath}
          onSelect={() => onSelect(field.path)}
        />
      ))}
    </DividedSection>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card accent={queued.length > 0 ? "attend" : "none"}>
        <CardHeader filled>
          <Eyebrow variant="section">Decision queue</Eyebrow>
          <span className="font-mono text-xs text-ink-muted">{queued.length} awaiting you</span>
        </CardHeader>
        <CardBody className="p-0">
          {queued.length === 0 ? (
            <div className="px-8 py-5">
              <EmptyNote>Every decision on this order is answered.</EmptyNote>
            </div>
          ) : (
            rows(queued)
          )}
        </CardBody>
      </Card>

      {settled.length === 0 ? null : (
        <Card>
          <CardHeader filled>
            <Eyebrow variant="section">Settled</Eyebrow>
            <span className="font-mono text-xs text-ink-muted">
              {settled.length} — look, do not re-decide
            </span>
          </CardHeader>
          <CardBody className="p-0">{rows(settled)}</CardBody>
        </Card>
      )}
    </div>
  );
}
