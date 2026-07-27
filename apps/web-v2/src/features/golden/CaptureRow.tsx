import { DONT_KNOW, NOT_STATED, type CaptureField } from "./roster";
import { TextField } from "../../shared/ui/TextField";
import { Button } from "../../shared/ui/Button";
import { Chip } from "../../shared/ui/Chip";

interface CaptureRowProps {
  field: CaptureField;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/**
 * One captured field: a box, and the two ways of not filling it in.
 *
 * When a special value is set the input is REPLACED, not merely disabled — a
 * greyed-out box still reads as "a value that could be there", and the point of
 * `__DONT_KNOW__` is that it is a recorded answer, not an absence of one.
 */
export function CaptureRow({ field, value, onChange }: CaptureRowProps) {
  const special = value === DONT_KNOW || value === NOT_STATED;

  return (
    <div className="grid grid-cols-[13rem_1fr_auto] items-center gap-5 border-t border-line-subtle px-8 py-4 first:border-t-0">
      <label htmlFor={`golden-${field.code}`} className="flex flex-col">
        <span className="font-mono text-sm text-ink-primary">{field.code}</span>
        <span className="text-tiny text-ink-muted">{field.hint}</span>
      </label>

      {special ? (
        <Chip tone={value === DONT_KNOW ? "attend" : "neutral"} size="sm" bordered>
          {value === DONT_KNOW ? "could not read it" : "document is silent"}
        </Chip>
      ) : (
        <TextField
          id={`golden-${field.code}`}
          data-testid={`golden-${field.code}`}
          aria-label={field.label}
          value={value ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? undefined : next);
          }}
        />
      )}

      <div className="flex gap-2">
        {special ? (
          <Button size="sm" fill="ghost" tone="neutral" onClick={() => onChange(undefined)}>
            clear
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              fill="outlined"
              tone="attend"
              onClick={() => onChange(DONT_KNOW)}
            >
              {"DON'T KNOW"}
            </Button>
            <Button
              size="sm"
              fill="outlined"
              tone="neutral"
              onClick={() => onChange(NOT_STATED)}
            >
              NOT STATED
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
