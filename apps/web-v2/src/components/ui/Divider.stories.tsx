import type { Meta, StoryObj } from "@storybook/react-vite";
import { Divider } from "./Divider";

const meta = { title: "ui/Divider", component: Divider } satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};

/** Orientation reaches assistive technology; a vertical `<hr>` would not. */
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-20 items-center gap-8">
      <span>Fulton</span>
      <Divider {...args} />
      <span>Shelby</span>
    </div>
  ),
};
