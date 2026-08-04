import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "./Chip";

const meta = {
  title: "Primitives/Chip",
  component: Chip,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  args: { children: "Live" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Chip tone="action" bordered>Pending</Chip>
      <Chip tone="settled">Delivered</Chip>
      <Chip tone="attend">Escalated</Chip>
      <Chip tone="halt" bordered>Load-bearing</Chip>
      <Chip tone="neutral">Retired</Chip>
      <Chip tone="inverse">Yours</Chip>
    </div>
  ),
};

/**
 * `bordered` defaults off because the design omits the border on neutral,
 * settled and attend chips and keeps it on action and halt. Defaulting it on
 * would quietly restyle three families.
 */
export const Bordered: Story = {
  args: { children: "Ruled" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Chip tone="action">no border</Chip>
      <Chip tone="action" bordered>bordered</Chip>
      <Chip tone="halt">no border</Chip>
      <Chip tone="halt" bordered>bordered</Chip>
    </div>
  ),
};

export const Sizes: Story = {
  args: { children: "Gate" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Chip size="micro" tone="halt" bordered>Stopped</Chip>
      <Chip size="sm" tone="action" bordered>Auto-confirmed</Chip>
      <Chip size="md" tone="attend">Disclosure</Chip>
    </div>
  ),
};

export const Shapes: Story = {
  args: { children: "p47" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Chip shape="tag" tone="neutral">tag</Chip>
      <Chip shape="pill" tone="action" bordered>pill filter · 12</Chip>
      <Chip shape="mono" tone="action" bordered>p47</Chip>
      <Chip shape="mono" tone="neutral">config v4 · frozen</Chip>
    </div>
  ),
};
