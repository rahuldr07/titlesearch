import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, StatusMark } from "./Badge";

/**
 * Two shapes, and they are not interchangeable. `StatusMark` is free and
 * belongs in every row; `Badge` is a tinted capsule and rule 6 reserves it for
 * moments of record — released, quarantine clear, T1.
 */
const meta = {
  title: "ui/Badge",
  component: Badge,
  args: { children: "Released" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Settled: Story = { args: { tone: "settled" } };
export const Attend: Story = { args: { tone: "attend", children: "Needs review" } };
export const Halt: Story = { args: { tone: "halt", children: "Quarantined" } };

/** Rule 1: this spends the accent. Once per screen, with the primary action. */
export const Accent: Story = { args: { tone: "accent", children: "Open decision" } };

/** The row-level signal: mark plus weight, no capsule, no fill. */
export const Marks: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <StatusMark mark="settled" label="Settled" />
      <StatusMark mark="attend" label="Needs review" />
      <StatusMark mark="halt" label="Blocked" />
      <StatusMark mark="tier1" label="Tier 1 exposure" />
    </div>
  ),
};

/** A tick on a row you are not being asked to act on. Desaturated, not hidden. */
export const RestingMark: Story = {
  render: () => <StatusMark mark="settled" label="Settled" resting />,
};
