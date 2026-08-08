import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextArea, TextField } from "../../shared/ui/TextField";

/**
 * One labelled input of the rule form. The four fields drew the same
 * Eyebrow-plus-input pair four times; the pair is the pattern, so it is built
 * once (§6: no duplicated blocks — the third use makes the component).
 *
 * `required` drives the whole halt treatment — label tone, input tone and
 * emphasis together — because they are one statement ("this field is the load-
 * bearing one"), not three independent choices to drift apart.
 *
 * `rows` decides the control: present is a TextArea, absent the one-line
 * TextField. The form's only single-line field is Scope.
 */
export function RuleInput({
  id,
  label,
  value,
  placeholder,
  onChange,
  rows,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
}) {
  const tone = required ? ("halt" as const) : undefined;
  return (
    <div className="mt-4 flex flex-col gap-3 first:mt-0">
      <Eyebrow variant="field" as="label" htmlFor={id} tone={tone}>
        {label}
      </Eyebrow>
      {rows === undefined ? (
        <TextField
          id={id}
          size="sm"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <TextArea
          id={id}
          size="sm"
          rows={rows}
          tone={tone}
          emphasis={required}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
