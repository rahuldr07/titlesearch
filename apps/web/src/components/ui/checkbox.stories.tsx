import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Checkbox } from "./checkbox";
import { onPanel } from "./kitGround";

/**
 * Every state, and the one that matters most is `Blocked`: rule 9 says a
 * disabled control states its reason, and the `play` asserts the SENTENCE is on
 * the DOM rather than merely that the box is inert.
 */
const meta = {
  title: "ui/Checkbox",
  decorators: [onPanel],
  component: Checkbox,
  args: {},
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resting and unchecked. */
export const Unchecked: Story = { args: { "aria-label": "Include retired rules" } };

/** Checked — the ✓ of rule 7's vocabulary, on the accent fill. */
export const Checked: Story = {
  args: { defaultSelected: true, "aria-label": "Include retired rules" },
};

/** Partially checked: a header box over a partly selected set. Draws •. */
export const Indeterminate: Story = {
  args: { isIndeterminate: true, "aria-label": "Include retired rules" },
};

/** With a label beside it, which is how a form actually renders one. */
export const WithLabel: Story = {
  render: (args) => (
    <Checkbox {...args} className="gap-4">
      <span className="font-sans text-meta leading-close text-ink-primary">
        Include retired rules
      </span>
    </Checkbox>
  ),
};

/**
 * BLOCKED, WITH THE RULE. Not `disabled` — there is no such prop. The reason
 * lands on `title` and on `data-disabled-reason`, and `e2e/invariants` reads
 * the latter.
 */
export const Blocked: Story = {
  args: {
    "aria-label": "Include retired rules",
    disabledBecause: "Blocked: the order is released and its rule set is frozen.",
  },
  play: ({ canvasElement }) => {
    // Two carriers, asserted separately because they live on two nodes and a
    // single query would have hidden the react-aria `title` drop (blockedHint.tsx).
    const box = canvasElement.querySelector("[data-disabled-reason]");
    expect(box?.getAttribute("data-disabled-reason")).toContain("released");
    expect(canvasElement.querySelector("[title]")?.getAttribute("title")).toContain("released");
  },
};

/** Blocked while checked — the state stays visible, it does not reset. */
export const BlockedChecked: Story = {
  args: {
    "aria-label": "Include retired rules",
    defaultSelected: true,
    disabledBecause: "Blocked: the order is released and its rule set is frozen.",
  },
};

/** All states side by side. */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-6 font-sans text-meta leading-close text-ink-primary">
      <Checkbox className="gap-4">
        <span>Unchecked</span>
      </Checkbox>
      <Checkbox className="gap-4" defaultSelected>
        <span>Checked</span>
      </Checkbox>
      <Checkbox className="gap-4" isIndeterminate>
        <span>Indeterminate</span>
      </Checkbox>
      <Checkbox className="gap-4" disabledBecause="Blocked: the order is released.">
        <span className="text-ink-disabled">Blocked — hover for the rule</span>
      </Checkbox>
    </div>
  ),
};
