import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";

import { PRODUCT_CHIPS } from "./registry";

/**
 * "Resolve against baseline:" — the selector that makes everything below it
 * mean something.
 *
 * A client's overrides are deltas, and a delta shown without the thing it
 * differs from is unreadable: "line 6 waived" is a formality on a product that
 * never asked for line 6 and a load-bearing claim on one that did. So the
 * baseline is a first-class control at the top of the resolution, never an
 * assumed default buried in a settings page.
 *
 * The chips carry product CODES rather than full names because they sit inline
 * in a sentence and six full names wrap into a paragraph.
 */
export function ProductChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (productId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      <span className="text-xs text-ink-muted">Resolve against baseline:</span>
      <ToggleGroup
        aria-label="Resolve against baseline"
        value={[value]}
        onValueChange={(next) => {
          const picked = next[0];
          // Re-clicking the active chip would otherwise clear the selection and
          // leave the panel resolving against nothing.
          if (picked !== undefined) onChange(picked);
        }}
      >
        {PRODUCT_CHIPS.map((p) => (
          <Toggle key={p.id} value={p.id} aria-label={p.name}>
            {p.code}
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  );
}
