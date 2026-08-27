import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { onPanel } from "./kitGround";

/**
 * Two levels of blocking, and they carry DIFFERENT sentences: the whole group
 * can be frozen ("this order is released") while a single option can be barred
 * for its own reason ("you ruled this field, a T1 countersign must be someone
 * else" — rule 13). Neither is derived from the other.
 */
const meta = {
  title: "ui/RadioGroup",
  decorators: [onPanel],
  component: RadioGroup,
  args: { "aria-label": "Disposition" },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = (
  <>
    <RadioGroupItem value="accept">Accept the extracted reading</RadioGroupItem>
    <RadioGroupItem value="correct">Correct it by hand</RadioGroupItem>
    <RadioGroupItem value="escalate">Escalate to an examiner</RadioGroupItem>
  </>
);

/** Nothing chosen yet. */
export const Unselected: Story = {
  render: (args) => <RadioGroup {...args}>{options}</RadioGroup>,
};

/** One chosen. */
export const Selected: Story = {
  args: { defaultValue: "correct" },
  render: (args) => <RadioGroup {...args}>{options}</RadioGroup>,
};

/** The whole group frozen, with the rule on the group. */
export const GroupBlocked: Story = {
  args: {
    defaultValue: "accept",
    disabledBecause: "Blocked: the order is released and its dispositions are fixed.",
  },
  render: (args) => <RadioGroup {...args}>{options}</RadioGroup>,
  play: ({ canvasElement }) => {
    // Two carriers on two nodes — the `title` sits on BlockedHint's wrapper,
    // because react-aria filters `title` off the composite (blockedHint.tsx).
    expect(
      canvasElement.querySelector('[data-slot="radio-group"][data-disabled-reason]'),
    ).not.toBeNull();
    expect(canvasElement.querySelector("[title]")?.getAttribute("title")).toContain("released");
  },
};

/** ONE option barred, for its own reason. Rule 13, rendered rather than hidden. */
export const OneOptionBlocked: Story = {
  render: (args) => (
    <RadioGroup {...args}>
      <RadioGroupItem value="accept">Accept the extracted reading</RadioGroupItem>
      <RadioGroupItem value="correct">Correct it by hand</RadioGroupItem>
      <RadioGroupItem
        value="countersign"
        disabledBecause="Blocked: a T1 countersign must come from a different user than the ruling examiner."
      >
        Countersign the T1 ruling
      </RadioGroupItem>
    </RadioGroup>
  ),
  play: ({ canvasElement }) => {
    const item = canvasElement.querySelector(
      '[data-slot="radio-group-item"][data-disabled-reason]',
    );
    expect(item?.getAttribute("data-disabled-reason")).toContain("different user");
  },
};

/** Rule 12: the blocked option renders, disabled, with its rule. Never hidden. */
export const BlockedIsVisibleNotHidden: Story = {
  args: { defaultValue: "accept" },
  render: (args) => (
    <div className="flex flex-col gap-8">
      <RadioGroup {...args}>
        <RadioGroupItem value="accept">Accept the extracted reading</RadioGroupItem>
        <RadioGroupItem
          value="release"
          disabledBecause="Blocked: 4 of 18 decisions are unsettled."
        >
          Release the certificate
        </RadioGroupItem>
      </RadioGroup>
      <p className="font-sans text-label leading-flat text-ink-muted">
        The reader learns the option exists and what would unlock it.
      </p>
    </div>
  ),
};
