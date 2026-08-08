import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";

/**
 * A labelled row of exclusive choices — the drawer's one repeated control.
 *
 * The forms ask several questions of exactly this shape (group, answer shape,
 * comment rule, how the period derives) and each one is a label above a toggle
 * row with the label as its accessible name. Written out per question, the
 * `aria-label` is the part that goes missing first, and a toggle row with no
 * name is a control a screen reader announces as four unrelated buttons.
 */
export function ChoiceField({
  label,
  options,
  value,
  onValueChange,
  toggleClassName = "",
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onValueChange: (value: readonly string[]) => void;
  /** The group toggles keep the default radius; the rest of the drawer rounds. */
  toggleClassName?: string;
}) {
  return (
    <div>
      <Eyebrow variant="field" as="h3">
        {label}
      </Eyebrow>
      <ToggleGroup
        className="mt-3"
        aria-label={label}
        value={value}
        onValueChange={onValueChange}
      >
        {options.map((o) => (
          <Toggle key={o.value} value={o.value} className={toggleClassName}>
            {o.label}
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  );
}
