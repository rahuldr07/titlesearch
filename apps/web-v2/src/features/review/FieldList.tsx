import type { Field } from "@titlepipe/contract";
import { FieldRow } from "./FieldRow";
import { Card, CardBody } from "../../shared/ui/Card";

/**
 * EVERY FIELD IS LISTED, not only the queued ones.
 *
 * The queue is what needs a decision; the list is what is going out the door.
 * A reviewer has to be able to look at an auto-confirmed field — that is how a
 * bad threshold gets noticed — but only the queued rows are walkable by
 * keyboard, so looking stays looking and does not turn into re-deciding.
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
  return (
    <Card>
      <CardBody className="p-0">
        <ul>
          {fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              selected={field.path === selectedPath}
              onSelect={() => onSelect(field.path)}
            />
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
