import type { Meta, StoryObj } from "@storybook/react-vite";
import { RequiredComment } from "./RequiredComment";

const meta = {
  title: "Primitives/RequiredComment",
  component: RequiredComment,
  parameters: { layout: "padded" },
} satisfies Meta<typeof RequiredComment>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Press the button with the field empty: the refusal SAYS WHY. A disabled
 * button that explains nothing is the defect `ux.spec` #5/#6 (orphan O10) pin
 * shut — it tells a keyboard or screen-reader user nothing about what is
 * missing.
 *
 * The nudge is `role="alert"` and linked by `aria-describedby`, so it is
 * announced rather than only seen.
 */
export const CorrectionReason: Story = {
  args: {
    label: "Why is this correction right?",
    submitLabel: "Save the correction",
    missingMessage: "A correction needs both the value and its why.",
    placeholder: "The page reads SOUTHSTONE; B's zeros are the OCR failure mode.",
    onSubmit: () => {},
  },
};

export const EscalationQuestion: Story = {
  args: {
    label: "What are you asking?",
    submitLabel: "Escalate to a senior",
    missingMessage: "An escalation needs its question.",
    placeholder: "Order sheet says 03029 — which source wins?",
    onSubmit: () => {},
  },
};

export const PassReason: Story = {
  args: {
    label: "Why are you passing?",
    submitLabel: "Pass this order",
    missingMessage: "A pass needs its why.",
    placeholder: "Never done a Cobb Co. tax card.",
    rows: 2,
    onSubmit: () => {},
  },
};

export const GoldenCorrection: Story = {
  args: {
    label: "Source and reason",
    submitLabel: "Correct the seed",
    missingMessage: "A correction with no source is an opinion.",
    placeholder: "Security deed p 3, amount in words — words prevail over numerals.",
    onSubmit: () => {},
  },
};
