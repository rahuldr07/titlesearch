import type { Preferences } from "@titlepipe/contract";
import { cn } from "../../shared/ui/classNames";

/**
 * THEME AS A STATE YOU CAN READ, not an instruction you have to invert.
 *
 * It was one menu row reading "Switch to Mocha theme". To learn which theme was
 * live you had to notice which one the sentence was offering and conclude you
 * were in the other — the control described its own effect and never its
 * subject. Two segments with the live one filled says where you are and where
 * you can go at a glance, and it is the same segmented pattern the queue's view
 * toggle already uses, so it is not a new idiom to learn.
 *
 * THE PREFERENCE IS SERVER-SIDE (decision C16). Nothing here writes to browser
 * storage — §9.11 forbids it outright, and a preference kept in localStorage
 * silently resets on the machine somebody actually works on. `onToggle` reports
 * the intent upward; the server's answer is what the app re-renders from.
 *
 * TWO THEMES, SO A TOGGLE IS HONEST. If a third ever lands, `onToggle` must
 * become `onChoose(id)` — the shape is deliberately one that will NOT silently
 * keep working with three options in it, because "toggle" would then mean
 * whichever of the other two the caller happened to pick.
 */
const THEMES = [
  { id: "titlepipe", label: "Paper" },
  { id: "mocha", label: "Mocha" },
] as const;

export function ThemeChoice({
  theme,
  onToggle,
}: {
  theme: Preferences["theme"];
  onToggle: () => void;
}) {
  return (
    <div className="flex rounded-4 border border-line-subtle p-0.5">
      {THEMES.map((option) => {
        const live = option.id === theme;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={live}
            // The segment that CHANGES something keeps the old id, so anything
            // that clicked `theme-toggle` to flip the theme still does.
            data-testid={live ? `theme-${option.id}` : "theme-toggle"}
            onClick={live ? undefined : onToggle}
            className={cn(
              "rounded-3 px-4 py-2 text-micro font-semibold",
              live ? "bg-ink-primary text-surface-panel" : "text-ink-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
