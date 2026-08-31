import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";

/**
 * There is no disabled-without-a-reason story because the type makes one
 * impossible to write (disabled.ts).
 */
const meta = {
  title: "ui/Button",
  component: Button,
  args: { children: "Launch workstation" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The accent fill. At most one of these per screen. */
export const Primary: Story = { args: { variant: "primary" } };

/** The default: white on a control border. Everything that is not the one. */
export const Secondary: Story = { args: { variant: "secondary" } };

/** Borderless, ink-secondary w500. Toolbars, row actions, dismissals. */
export const Ghost: Story = { args: { variant: "ghost", children: "Dismiss" } };

/** Halt as an outline — the accent is the only solid fill in this palette. */
export const Halt: Story = { args: { variant: "halt", children: "Quarantine order" } };

/** 30px. Row actions and chips; still clears WCAG §2.5.8's 24px floor. */
export const Small: Story = { args: { size: "sm", children: "Open" } };

/** 44px, for the one action a decision screen leads with. */
export const Large: Story = { args: { size: "lg", variant: "primary" } };

/** Blocked renders disabled with the rule, never hidden. */
export const BlockedWithReason: Story = {
  args: {
    variant: "primary",
    children: "Sign & execute release",
    disabledBecause: "Blocked: T1 second read not countersigned.",
  },
};

/** Every variant has a disabled rendering, and every one of them says why. */
export const SecondaryBlocked: Story = {
  args: {
    variant: "secondary",
    children: "Reassign",
    disabledBecause: "Blocked: you are the ruling examiner on this order.",
  },
};

export const GhostBlocked: Story = {
  args: {
    variant: "ghost",
    children: "Skip",
    disabledBecause: "Blocked: the queue is not cherry-pickable.",
  },
};

export const HaltBlocked: Story = {
  args: {
    variant: "halt",
    children: "Quarantine order",
    disabledBecause: "Blocked: quarantine needs a supervisor role.",
  },
};

/**
 * There is no invalid button story because there is no invalid button —
 * invalid is a field state; see ui/Field.
 */

/** Icon-only still clears §2.5.8's 24x24 floor, and still needs a name. */
export const IconOnly: Story = {
  args: { icon: true, size: "sm", children: "↺", "aria-label": "Replay extraction" },
};

/**
 * Hover is a pseudo-state Storybook cannot set from args, so it is shown as a
 * row rather than faked: the three live variants side by side, to be hovered.
 */
export const HoverRow: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <Button variant="primary">Confirm</Button>
      <Button variant="secondary">Back</Button>
      <Button variant="ghost">Dismiss</Button>
      <Button variant="halt">Quarantine</Button>
    </div>
  ),
};
