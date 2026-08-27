import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

/**
 * One story per variant, plus the state Storybook exists to check: a disabled
 * button that says why. There is no "disabled" story WITHOUT a reason, because
 * the type makes one impossible to write — which is the point of the whole
 * `disabledBecause` design and is worth seeing in the gallery.
 */
const meta = {
  title: "ui/Button",
  component: Button,
  args: { children: "Launch workstation" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Rule 1: the accent fill. At most one of these per screen. */
export const Primary: Story = { args: { variant: "primary" } };

export const Secondary: Story = { args: { variant: "secondary" } };

export const Quiet: Story = { args: { variant: "quiet", children: "Dismiss" } };

/** Halt, drawn as an outline — the accent is the only solid fill. */
export const Danger: Story = { args: { variant: "danger", children: "Quarantine" } };

export const Small: Story = { args: { size: "sm", children: "Open" } };

export const Large: Story = { args: { size: "lg", variant: "primary" } };

/** Rule 9 / rule 12: blocked renders disabled WITH the rule, never hidden. */
export const BlockedWithReason: Story = {
  args: {
    variant: "primary",
    children: "Sign & execute release",
    disabledBecause: "Blocked: T1 second read not countersigned.",
  },
};

/** Icon-only still clears §2.5.8's 24x24 floor and still needs a name. */
export const IconOnly: Story = {
  args: { icon: true, size: "sm", children: "↺", "aria-label": "Replay extraction" },
};
