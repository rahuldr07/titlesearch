import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tooltip, TooltipProvider } from "./Tooltip";

const meta = {
  title: "Primitives/Tooltip",
  component: Tooltip,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * ⚠ This appearance is DERIVED, not drawn. The export has no tooltip — only
 * three native `title=` attributes — so the styling borrows the menu's floating
 * treatment. Use it for the compare-matrix cell only; every other explanation
 * in the design is rendered inline beneath its control, which is better and
 * should stay the default.
 */
export const MatrixCell: Story = {
  args: { content: "", children: null },
  render: () => (
    <TooltipProvider>
      <div className="flex items-center gap-8">
        <Tooltip content="Summit Valley Bank, N.A. — waived, off this client's list">
          <span className="inline-flex size-12 items-center justify-center rounded-3 border border-line-strong bg-surface-panel text-sm">
            —
          </span>
        </Tooltip>
        <Tooltip content="Cascade Title Co. — narrowed to recorded instruments only">
          <span className="inline-flex size-12 items-center justify-center rounded-3 border border-line-strong bg-surface-panel text-sm font-bold text-state-attend">
            ◐
          </span>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};
