import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DecisionCard } from "./DecisionCard";

const meta = {
  title: "Field/DecisionCard",
  component: DecisionCard,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DecisionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

const field = {
  section: "Judgments & liens",
  label: "Debtor name",
  asking: "Is the vested owner MARIA L. ESTRADA or MARIA I. ESTRADA?",
  why: "The two readers differ on the middle initial. R13 makes party identity a distinct check from status — a middle-initial-only difference is a match, but only a person can say so here.",
};

const readings = [
  { engineId: "gemini-2.5-flash", value: "MARIA L. ESTRADA", page: 31 },
  { engineId: "llmwhisperer-hq", value: "MARIA I. ESTRADA", page: 31 },
];

const actions = {
  onConfirm: noop,
  onCorrect: noop,
  onEscalate: noop,
  onAdopt: noop,
  onNotOurParty: noop,
  canExclude: true,
};

/**
 * THE QUESTION FRAMING IS THE DESIGN'S BEST IDEA and is kept — a flagged field
 * put as a question the reviewer answers beats a flag they must interpret.
 * What is dropped is the answer the export supplied with it.
 *
 * ASSUMPTION, STATED (BRIEF §12): ruling Q2 / conflict C7 is not formally
 * confirmed. This resolves it the way the invariants require — both readings
 * attributed, neither pre-selected (`review.spec` #3, CONTEXT §8.3) — and keeps
 * the question framing above them. The ARRANGEMENT is my composition, not
 * something the design drew.
 */
export const Expanded: Story = {
  args: {
    field,
    readings,
    actions,
    status: { state: "pending", label: "Pending" },
    expanded: true,
    onExpand: noop,
  },
  render: (args) => (
    <div className="max-w-200">
      <DecisionCard {...args} />
    </div>
  ),
};

export const Collapsed: Story = {
  args: { ...Expanded.args, expanded: false },
  render: (args) => (
    <div className="max-w-200">
      <DecisionCard {...args} />
    </div>
  ),
};

/**
 * State and its label are SERVER-SUPPLIED. `server-owns-state.spec` (2
 * INVARIANTs) pins that confidence never promotes or demotes a field, and
 * constraint 9 forbids deriving status in the browser.
 */
export const ServerStates: Story = {
  args: { ...Expanded.args, expanded: false },
  render: (args) => (
    <div className="flex max-w-200 flex-col gap-5">
      <DecisionCard {...args} status={{ state: "pending", label: "Pending" }} />
      <DecisionCard {...args} status={{ state: "confirmed", label: "Confirmed" }} />
      <DecisionCard {...args} status={{ state: "corrected", label: "Corrected" }} />
      <DecisionCard {...args} status={{ state: "escalated", label: "Escalated" }} />
      <DecisionCard {...args} status={{ state: "notparty", label: "Not our party" }} />
    </div>
  ),
};

/** Expanding moves the card into the reviewer's focus — the real interaction. */
export const Interactive: Story = {
  args: { ...Expanded.args, expanded: false },
  render: function Interactive(args) {
    const [open, setOpen] = useState(false);
    return (
      <div className="max-w-200">
        <DecisionCard {...args} expanded={open} onExpand={() => setOpen((v) => !v)} />
      </div>
    );
  },
};
