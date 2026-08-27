import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "./Switch";

/**
 * A switch is a setting that takes effect immediately; a checkbox proposes a
 * value a Save commits. Manifest include/omit is a switch.
 */
const meta = {
  title: "ui/Switch",
  component: Switch,
  args: { children: "Include in publication manifest" },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = { args: { defaultSelected: true } };

export const BlockedWithReason: Story = {
  args: { disabledBecause: "Blocked: this block has an open field." },
};

export const OnAndBlocked: Story = {
  args: {
    defaultSelected: true,
    disabledBecause: "Blocked: required by the product; cannot be omitted.",
  },
};
