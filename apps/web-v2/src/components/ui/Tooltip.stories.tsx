import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tooltip, TooltipTrigger } from "./Tooltip";
import { Button } from "./Button";

/**
 * A tooltip only ever repeats or elaborates. The fact itself lives inline —
 * a disabled control states its reason in the DOM, not only on hover.
 */
const meta = { title: "ui/Tooltip", component: Tooltip } satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Jumps the evidence pane to the cited line." },
  render: (args) => (
    <TooltipTrigger>
      <Button icon size="sm" aria-label="Zoom to citation">
        Z
      </Button>
      <Tooltip {...args} />
    </TooltipTrigger>
  ),
};

export const Long: Story = {
  args: {
    children:
      "The second read must come from a different user than the ruling examiner. The server enforces this with a 409.",
  },
  render: (args) => (
    <TooltipTrigger>
      <Button>Countersign</Button>
      <Tooltip {...args} />
    </TooltipTrigger>
  ),
};
