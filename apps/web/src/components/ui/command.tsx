import type { ReactNode } from "react";
import {
  Autocomplete,
  Input as InputPrimitive,
  Menu,
  MenuItem,
  SearchField,
  useFilter,
  type MenuItemProps,
  type MenuProps,
} from "react-aria-components";
import { SearchIcon } from "lucide-react";

import { cx } from "./cx";
import { collectionItem, markGutter } from "./overlaySurface";

/**
 * THE COMMAND MENU — THE ONE OVERLAY THE CHORD LAYER WAS WRITTEN FOR.
 *
 * `CommandPalette`, the dialog-wrapped form, lives in `commandPalette.tsx`;
 * this file is the filtering shell and its three parts, which are also usable
 * inline inside a panel.
 *
 * `chords.ts` pins the prototype bug in this component's exact shape: "? then c
 * CONFIRMS A RULING from inside the cheat sheet — on a field carrying T1
 * exposure". A palette is opened BY a chord, is full of single letters, and
 * sits over a screen whose fields the same letters act on. If any overlay in
 * this kit gets the mark wrong, this is the one that costs a ruling.
 *
 * It is covered THREE ways and none is redundant:
 *
 *   1. `Dialog` renders `role="dialog"` — `overlayIsUp()`'s first clause.
 *   2. `Dialog`'s overlay carries `data-chord-scope="own"` — the second clause,
 *      live from the moment the scrim mounts, before focus moves inside.
 *   3. The search input is a real `<input>`, which `focusOwnsKeys` catches on
 *      tagName, and the list is `role="menu"` with `role="menuitem"` children —
 *      both in the role tables. So even a palette rendered inline, outside a
 *      dialog, still owns its keys.
 *
 * ══ ADAPTED FROM THE REGISTRY ═══════════════════════════════════════════════
 *
 * `rounded-xl!` → `rounded-lg` (14) and the `!` is gone — check-rules.mjs bans
 * Tailwind's important modifier, and it was there to beat the Dialog's own
 * radius, which now matches. `bg-popover`/`text-popover-foreground` →
 * `bg-surface-panel`/`text-ink-primary`. `text-sm`/`text-xs` → the 16px body
 * and 13px meta rungs. The registry's `CommandShortcut` — a right-aligned
 * `text-muted-foreground` span — becomes `CommandKeys`, drawn in MONO, because
 * rule 3 names kbd as data.
 */
/**
 * The filtering shell, usable inline as well as in the dialog.
 *
 * `useFilter({ sensitivity: "base" })` is the Intl-backed comparison
 * react-aria ships: it matches "Reçu" from "recu", which a `toLowerCase()`
 * `includes` does not. County names and grantor strings are exactly the data
 * where that is not academic.
 */
export function Command({ children }: { readonly children: ReactNode }) {
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <div data-slot="command" className="flex flex-col">
      <Autocomplete filter={contains}>{children}</Autocomplete>
    </div>
  );
}

/**
 * The search row. A BAND inside the dialog's surface, not a card and not an
 * input box: nested cards are forbidden (RECIPES.md §Card), and an input
 * chrome box drawn inside a panel that is already a box is the same defect one
 * rung down. So it is a hairline-ruled row on `--color-control-fill` with no
 * border and no radius of its own.
 */
export function CommandInput({ placeholder = "Search commands…" }: { readonly placeholder?: string }) {
  return (
    <SearchField
      autoFocus
      aria-label={placeholder}
      data-slot="command-input"
      className="flex items-center gap-5 border-b border-line-subtle bg-control-fill px-8 py-6"
    >
      <SearchIcon aria-hidden size={16} className="shrink-0 text-ink-muted" />
      <InputPrimitive
        placeholder={placeholder}
        className={cx(
          "min-w-0 flex-1 bg-transparent font-sans text-body leading-close",
          "text-ink-primary outline-none placeholder:text-ink-muted",
        )}
      />
    </SearchField>
  );
}

/** The results list. `role="menu"`, and its items are `role="menuitem"`. */
export function CommandList<T extends object>(props: MenuProps<T>) {
  return (
    <Menu
      {...props}
      data-slot="command-list"
      className="flex max-h-160 flex-col gap-1 overflow-auto p-2 outline-none"
      renderEmptyState={() => (
        <div className="px-6 py-8 text-center font-sans text-meta leading-close text-ink-muted">
          No commands match.
        </div>
      )}
    />
  );
}

export type CommandItemProps = Omit<MenuItemProps, "className" | "children" | "textValue"> & {
  /** Plain text. Doubles as the filter and typeahead string. */
  readonly children: string;
  /** The chord that runs this command, e.g. "c". Rendered in mono — rule 3. */
  readonly keys?: string | undefined;
};

export function CommandItem({ children, keys, ...props }: CommandItemProps) {
  return (
    <MenuItem
      {...props}
      textValue={children}
      data-slot="command-item"
      className={cx(collectionItem, "justify-between")}
    >
      <span className="flex min-w-0 items-center gap-4">
        {/* The ✓ gutter keeps every label on one left edge whether or not a
            row is selected. Rule 6's mark, not a lucide CheckIcon. */}
        <span aria-hidden className={markGutter} />
        <span className="truncate">{children}</span>
      </span>
      {keys !== undefined && (
        <kbd className="shrink-0 rounded-xs border border-line-strong bg-surface-sunken px-3 py-1 font-mono text-label leading-flat text-ink-muted">
          {keys}
        </kbd>
      )}
    </MenuItem>
  );
}
