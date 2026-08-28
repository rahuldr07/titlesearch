import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { useCommands, type PaletteEntry } from "./commands";
import { useOverlays } from "./overlays";
import { PaletteRow, PaletteLegend } from "./PaletteRow";
import { useRead } from "../useRead";
import { ordersPage } from "../../shared/ordersQueries";
import { QueryState } from "../../entities/state/QueryState";
import { Kbd } from "../../components/ui";

/**
 * THE PALETTE'S CONTENTS — mounted ONLY while the palette is open, which is the
 * whole reason it is a separate component from the shell.
 *
 * `CommandPalette` sits at the root for the app's lifetime. A `useRead` in that
 * component would fire `GET /api/orders` at boot, on every screen, for a panel
 * nobody had opened. React Aria unmounts the modal's children when it closes,
 * so putting the read here makes "the palette asks for orders" mean exactly
 * what it says.
 *
 * `q` goes to the browse endpoint, so the SERVER matches orders and nothing
 * here re-states its filter; screens and actions are local strings matched
 * locally, every typed token against label, hint or group. The query is
 * DEBOUNCED into the descriptor, not into the input: the box stays live at
 * every keystroke and the network settles behind it.
 */
export function PaletteBody(props: {
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
}) {
  const navigate = useNavigate();
  const close = useOverlays((s) => s.close);
  const commands = useCommands(props.rules);
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 180);
    return () => clearTimeout(timer);
  }, [query]);

  const orders = useRead(ordersPage({ query: settled, filter: "all", page: 1 }));

  const local = useMemo(() => matching(commands, query), [commands, query]);
  const found = useMemo<readonly PaletteEntry[]>(
    () =>
      (orders.data?.orders ?? []).map((order) => ({
        id: `order:${order.id}`,
        label: `${order.order_ref} · ${order.addr}`,
        hint: [order.client, order.place, order.stage, order.due]
          .filter((part) => part !== null && part !== "")
          .join(" · "),
        group: "Orders",
        run: () => {
          close("palette");
          void navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
        },
      })),
    [orders.data, close, navigate],
  );

  const screens = local.filter((entry) => entry.group === "Screens");
  const actions = local.filter((entry) => entry.group === "Actions");
  const entries = [...screens, ...found, ...actions];
  const selected = entries[Math.min(index, Math.max(entries.length - 1, 0))];

  return (
    <>
      <div className="flex items-center gap-6 border-b border-line-subtle px-12 py-3">
        <input
          data-testid="command-palette-input"
          autoFocus
          aria-label="Search screens, orders and actions"
          placeholder="Type a screen, an order, an address or an action"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            const count = entries.length;
            if (count === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((i) => (i + 1) % count);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((i) => (i - 1 + count) % count);
            } else if (event.key === "Enter") {
              event.preventDefault();
              selected?.run();
            }
          }}
          className="h-18 min-w-0 flex-1 text-body leading-flat text-ink-primary placeholder:text-ink-faint"
        />
        <Kbd>Esc</Kbd>
      </div>

      <div className="flex max-h-160 flex-col gap-1 overflow-y-auto p-4">
        <List entries={screens} selected={selected?.id} />
        <QueryState query={orders} of="orders" failedTitle="Orders could not be read.">
          {() => <List entries={found} selected={selected?.id} />}
        </QueryState>
        <List entries={actions} selected={selected?.id} />
        {entries.length === 0 && !orders.isPending && (
          <p
            data-testid="command-palette-empty"
            className="py-16 text-center text-meta leading-body text-ink-faint"
          >
            No results found
          </p>
        )}
      </div>

      <PaletteLegend />
    </>
  );
}

function List(props: {
  readonly entries: readonly PaletteEntry[];
  readonly selected: string | undefined;
}) {
  if (props.entries.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {props.entries.map((entry) => (
        <li key={entry.id}>
          <PaletteRow entry={entry} isSelected={entry.id === props.selected} />
        </li>
      ))}
    </ul>
  );
}

/** Every typed token must appear in the label, the hint or the group. */
function matching(
  entries: readonly PaletteEntry[],
  query: string,
): readonly PaletteEntry[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return entries;
  return entries.filter((entry) => {
    const hay = `${entry.label} ${entry.hint} ${entry.group}`.toLowerCase();
    return tokens.every((token) => hay.includes(token));
  });
}
