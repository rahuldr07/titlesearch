import { cn } from "./classNames";

/** One card: an id the caller submits, a title, and the line under it. */
/** One card's shape — callers pass literals, so the grid owns the type. */
interface ChoiceCardOption {
  id: string;
  title: string;
  sub?: string;
}

export interface ChoiceCardGridProps {
  /** The radio `name`. One name = one choice; two grids must not share it. */
  name: string;
  columns: 2 | 3;
  options: readonly ChoiceCardOption[];
  /** `null` is "nobody has chosen yet" — never a silent default. */
  value: string | null;
  onSelect: (id: string) => void;
}

/**
 * A GRID OF CARDS THAT IS A RADIO GROUP, because that is what it is.
 *
 * RULE: single choice is a radio group, not a row of pressed buttons. The
 * design draws these as `<button>` elements carrying a fill, and the export's
 * own client and product pickers are exactly that. A button reports "pressed"
 * one at a time and never says how many alternatives exist or which set it
 * belongs to, so a screen reader hears six unrelated buttons where the design
 * shows one question with six answers.
 *
 * FAILURE PREVENTED: an abstractor who cannot see the grid picks the client
 * that resolves the sign-off list without ever being told the choice is
 * exclusive, or that a choice was already made. Native radios sharing a `name`
 * give arrow-key traversal, "3 of 6", and one tab stop for the whole question
 * for free — and the enclosing `<fieldset>`/`<legend>` at the call site names
 * the question itself.
 *
 * THE INPUT IS REAL AND IS THE WHOLE CARD, not a replaced widget. It is
 * transparent and stretched over the card, so the thing a person clicks and the
 * thing a screen reader announces are ONE element — and the browser's own focus
 * ring lands on the card outline rather than on a 1px clipped box nobody can
 * see. Painting a `div` and syncing `aria-checked` by hand is how a picker ends
 * up unreachable by keyboard; hiding the input under the card text is how it
 * ends up unclickable for automation and for anyone using a pointer helper.
 *
 * SELECTION IS THE CALLER'S STATE. This component derives nothing and defaults
 * to nothing — `value === null` renders six unchosen cards, which is the honest
 * picture before anybody has answered.
 */
export function ChoiceCardGrid({
  name,
  columns,
  options,
  value,
  onSelect,
}: ChoiceCardGridProps) {
  return (
    <div className={cn("grid gap-4", columns === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map((option) => (
        <label
          key={option.id}
          className={cn(
            "group relative flex flex-col gap-2 rounded-8 px-6 py-5 text-left",
            // 1.5px: the design's weight for a load-bearing, choosable control.
            "border-(length:--stroke-emphasis) border-line-strong bg-surface-panel",
            "has-[:checked]:border-action has-[:checked]:bg-action",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={value === option.id}
            onChange={() => onSelect(option.id)}
            data-testid={`choice-${name}-${option.id}`}
            className="absolute inset-0 size-full cursor-pointer appearance-none rounded-8"
          />
          <span className="text-md font-semibold text-ink-primary group-has-[:checked]:text-ink-on-action">
            {option.title}
          </span>
          {option.sub === undefined ? null : (
            <span className="text-tiny leading-body text-ink-muted group-has-[:checked]:text-ink-on-action">
              {option.sub}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
