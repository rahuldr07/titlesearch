import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataTable, DataCell } from "./DataTable";
import { columnsFor } from "./tableFeatures";
import { StatusMark } from "./Badge";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

type Order = {
  readonly ref: string;
  readonly address: string;
  readonly client: string;
  readonly stage: string;
  readonly due: string;
};

const rows: readonly Order[] = [
  {
    ref: "4176034-1",
    address: "118 Peachtree Ln, Fulton County, GA",
    client: "Acme Title Co.",
    stage: "Examination",
    due: "2026-09-02",
  },
  {
    ref: "4176055-3",
    address: "44 Poplar Ave, Shelby County, TN",
    client: "Delta Lending",
    stage: "Intake",
    due: "2026-08-29",
  },
];

/**
 * Rule 3 is visible in the column set: `ref` and `due` are DATA and render mono
 * via `DataCell`; `address`, `client` and `stage` are prose and do not.
 *
 * Rule 6 is visible too, and by omission — there is exactly one status column,
 * and the table offers no `rowTone`, no striping and no per-row colour to add
 * a second signal with.
 */
const column = columnsFor<Order>();

const columns = [
  column.accessor("ref", {
    header: "Ref",
    cell: (context) => <DataCell>{context.getValue()}</DataCell>,
  }),
  column.accessor("address", { header: "Address" }),
  column.accessor("client", { header: "Client" }),
  column.display({
    id: "status",
    header: "Status",
    cell: () => <StatusMark mark="attend" label="Needs review" />,
  }),
  column.accessor("due", {
    header: "Due",
    cell: (context) => <DataCell>{context.getValue()}</DataCell>,
  }),
];

const meta = {
  title: "ui/DataTable",
  component: DataTable,
  args: {
    label: "All orders",
    data: rows,
    columns,
    empty: <EmptyState title="No orders" reason="Nothing has been ingested yet." />,
  },
} satisfies Meta<typeof DataTable<Order>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rows: Story = {};

export const SingleRow: Story = { args: { data: rows.slice(0, 1) } };

/** The empty branch renders whatever it was given; it never invents copy. */
export const Empty: Story = {
  args: {
    data: [],
    empty: (
      <EmptyState
        title="No orders match this search"
        reason="field:value terms are combined with AND. Try removing one."
        action={<Button>Clear search</Button>}
      />
    ),
  },
};
