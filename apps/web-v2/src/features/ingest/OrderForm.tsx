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
  onFile,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onFile: (file: File | null) => void;
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

      <label className="flex flex-col gap-2 sm:col-span-2">
        <Eyebrow variant="field">The county package</Eyebrow>
        <input
          type="file"
          accept="application/pdf"
          data-testid="package-input"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          className="rounded-5 border border-line-strong bg-surface-panel px-5 py-3 text-base text-ink-primary"
        />
      </label>
    </div>
  );
}
