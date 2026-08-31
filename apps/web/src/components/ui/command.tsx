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
 * The command menu's filtering shell and its parts, also usable inline in a
 * panel; the dialog-wrapped form lives in commandPalette.tsx.
 *
 * The filter uses useFilter({ sensitivity: "base" }) — Intl-backed, so
 * "recu" matches "Reçu", which a toLowerCase().includes() does not. County
 * names and grantor strings are exactly the data where that matters.
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
 * The search row: a band inside the dialog's surface, not an input box — a
 * hairline-ruled row on control-fill with no border and no radius of its own.
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
  /** The chord that runs this command, e.g. "c". Rendered in mono. */
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
            row is selected. */}
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
