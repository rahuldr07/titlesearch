import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Table } from "./table";
import { columns, orders, type Order } from "./tableStoryData";
import type { Decorator } from "@storybook/react-vite";

/**
 * A virtualized table needs a bounded scroll container — a story that omits
 * one renders every row. The height is fixed here rather than in table.tsx
 * because it is the screen's job: a table fills the pane it is given.
 */
const inPane: Decorator = (Story) => (
  <div className="h-160 w-240 overflow-hidden rounded-lg border border-line-strong bg-surface-panel">
    <Story />
  </div>
);

const meta = {
  title: "ui/Table",
  decorators: [inPane],
  component: Table<Order>,
  args: {
    label: "Orders",
    columns,
    rowKey: (r: Order) => r.ref,
    empty: <p>No orders.</p>,
  },
} satisfies Meta<typeof Table<Order>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A short table: every row is on screen, so virtualization is invisible. */
export const Short: Story = { args: { rows: orders(6) } };

/** Empty. The `empty` node replaces the grid entirely — no headers over nothing. */
export const Empty: Story = {
  args: {
    rows: [],
    empty: <p className="font-sans text-body text-ink-muted">No orders.</p>,
  },
  play: async () => {
    expect(document.querySelector("[role='grid']")).toBe(null);
  },
};

/**
 * It virtualizes: 5,000 rows of data, far fewer row nodes. The bound is a
 * generous 200 on purpose — the exact count depends on container height and
 * overscan, and pinning it would fail on a viewport change rather than a
 * regression. What it must not do is scale with the data.
 */
export const FiveThousandRows: Story = {
  args: { rows: orders(5000) },
  play: async () => {
    const rows = document.querySelectorAll("[data-slot='table-row']");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(200);
  },
};

/**
 * One status signal per row, asserted by counting the glyphs: a row carries
 * exactly one of ✓ ◆ •, and table.tsx exposes no rowTone, getRowClassName or
 * striping for a second signal to hide in.
 */
export const OneSignalPerRow: Story = {
  args: { rows: orders(12) },
  play: async () => {
    const rows = document.querySelectorAll("[data-slot='table-row']");
    for (const row of rows) {
      const glyphs = (row.textContent ?? "").match(/[✓◆•]/g) ?? [];
      expect(glyphs).toHaveLength(1);
    }
  },
};

/**
 * The chord mark is `widget`, not `own`: `own` is read document-wide and a
 * table is mounted permanently, so it would suspend the vocabulary for the
 * life of the screen. Both halves are asserted — the right mark present, the
 * wrong one absent.
 */
export const OwnsKeysOnlyWhileFocused: Story = {
  args: { rows: orders(20) },
  play: async () => {
    expect(document.querySelector("[data-chord-scope='widget']")).not.toBe(null);
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
    // The roles `focusRoles.ts` actually matches, present on the real DOM.
    expect(document.querySelector("[role='grid']")).not.toBe(null);
    expect(document.querySelector("[role='row']")).not.toBe(null);
    expect(document.querySelector("[role='gridcell']")).not.toBe(null);
  },
};
