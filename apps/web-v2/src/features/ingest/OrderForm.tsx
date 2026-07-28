import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";
import { ORDER_FIELDS } from "./orderFields";


/**
 * NOTHING IS PRE-VALIDATED HERE, and no field is marked required in advance.
 *
 * The door owns the definition of a complete order (§4.3). Marking fields
 * required in the client is a second copy of that definition, and the moment a
 * jurisdiction needs a sixth field the two disagree — with the client's version
 * winning silently, because it refuses before the server ever hears about it.
 */
export function OrderForm({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {ORDER_FIELDS.map((field) => (
        <label key={field.key} className="flex flex-col gap-2">
          <Eyebrow variant="field">{field.label}</Eyebrow>
          <TextField
            data-testid={`order-${field.key}`}
            value={values[field.key] ?? ""}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        </label>
      ))}

    </div>
  );
}
