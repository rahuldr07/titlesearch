import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Table } from "./table";
import { columns, orders, type Order } from "./tableStoryData";
import type { Decorator } from "@storybook/react-vite";

/**
 * A VIRTUALIZED TABLE NEEDS A BOUNDED SCROLL CONTAINER, and a story that omits
 * one is a story that renders every row — the exact defect these stories exist
 * to catch. The height is fixed here rather than inside `table.tsx` because it
 * is the SCREEN's job: a table fills the pane it is given (the app frame is one
 * viewport tall and scrolling happens inside panes, never on the page).
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
 * IT VIRTUALIZES, AND THIS IS THE ASSERTION THAT PROVES IT.
 *
 * 5,000 rows of data, and the DOM must hold far fewer than 5,000 `role="row"`
 * nodes. The bound is generous (200) on purpose: the exact count depends on the
 * container height and the overscan, and a story that pins it would fail on a
 * viewport change rather than on a regression. What it must NOT do is scale
 * with the data, and 200 « 5,000 says exactly that.
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
 * ONE STATUS SIGNAL PER ROW (rule 6). Asserted by counting the glyphs: a row
 * carries exactly one of ✓ ◆ •, and there is no second place in this table for
 * a tone or a capsule to appear, because `table.tsx` exposes no `rowTone`, no
 * `getRowClassName` and no striping.
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
 * THE CHORD CONTRACT, AND THE VALUE IS `widget` — NOT `own`.
 *
 * This is the finding review made: a focused row in a 5,000-row table killed
 * every chord. `own` is read DOCUMENT-WIDE by `overlayIsUp()` and a table is
 * mounted permanently, so `own` here would suspend the vocabulary for the life
 * of the screen whether or not anyone focused a row. `widget` is read only
 * against the active element's ancestors.
 *
 * Both halves are asserted: the right mark present, the wrong one absent.
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
