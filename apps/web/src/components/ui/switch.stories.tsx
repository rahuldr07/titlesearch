import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Switch } from "./switch";
import { onPanel } from "./kitGround";

/**
 * A switch commits immediately and has no confirm step, so every story here is
 * a VIEW PREFERENCE. The last story states the refusal: nothing that changes
 * the record may be a switch.
 */
const meta = {
  title: "ui/Switch",
  decorators: [onPanel],
  component: Switch,
  args: {},
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Off. */
export const Off: Story = { args: { "aria-label": "Show retired rules" } };

/** On — the accent fill and the thumb at the far end of its 16px travel. */
export const On: Story = {
  args: { defaultSelected: true, "aria-label": "Show retired rules" },
};

/** With its label, which is how a preferences pane renders one. */
export const WithLabel: Story = {
  render: (args) => <Switch {...args}>Show retired rules</Switch>,
};

/** Blocked off, with the rule. */
export const Blocked: Story = {
  args: {
    disabledBecause: "Blocked: your role cannot change rulebook visibility.",
  },
  render: (args) => <Switch {...args}>Show retired rules</Switch>,
  play: ({ canvasElement }) => {
    expect(canvasElement.querySelector("[data-disabled-reason]")).not.toBeNull();
    expect(canvasElement.querySelector("[title]")?.getAttribute("title")).toContain("role");
  },
};

/** Blocked on — the current state stays legible while being unchangeable. */
export const BlockedOn: Story = {
  args: {
    defaultSelected: true,
    disabledBecause: "Blocked: your role cannot change rulebook visibility.",
  },
  render: (args) => <Switch {...args}>Show retired rules</Switch>,
};

/** A preferences pane: several, stacked. */
export const APreferencesPane: Story = {
  render: () => (
    <div className="flex w-160 flex-col gap-8">
      <Switch defaultSelected>Follow the cursor into the scan</Switch>
      <Switch>Show retired rules</Switch>
      <Switch>Show the raw engine readings</Switch>
    </div>
  ),
};

/**
 * WHAT MAY NOT BE A SWITCH. A disposition changes the record and has no confirm
 * step here — that is a button and a sentence, not a toggle. Kept visible so
 * the refusal is something a reviewer has seen.
 */
export const NeverForTheRecord: Story = {
  render: () => (
    <div className="flex w-160 flex-col gap-6">
      <Switch>Release the certificate</Switch>
      <p className="font-sans text-label leading-flat text-state-halt">
        Defect — a release is a decision. Decisions get a button and a confirm step.
      </p>
    </div>
  ),
};
