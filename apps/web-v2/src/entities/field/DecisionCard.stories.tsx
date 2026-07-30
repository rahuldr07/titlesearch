import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { demoFields } from "@titlepipe/mocks";
import { DecisionCard } from "./DecisionCard";
import { stateLabel } from "./fieldLabel";

const meta = {
  title: "Field/DecisionCard",
  component: DecisionCard,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DecisionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const fieldAt = (path: string) => {
  const found = demoFields.find((f) => f.path === path);
  if (found === undefined) throw new Error(`no demo field at ${path}`);
  return found;
};

const readings = { onAdopt: noop, onPin: noop, pin: null };
const actions = {
  offerExclude: false,
  onConfirm: noop,
  onCorrect: noop,
  onEscalate: noop,
  onExclude: noop,
  onPass: noop,
};

/**
 * THE READING IS SHOWN ONCE (D4). The export draws a single sunken `As read`
 * row with the question above it; the build drew a bordered card per engine
 * with adopt buttons and roughly doubled the pane. Provenance survives the
 * fold — the page cite and the engine COUNT stay outside it.
 */
export const Disagreement: Story = {
  args: {
    field: fieldAt("mortgages.1.lender"),
    statusLabel: stateLabel(fieldAt("mortgages.1.lender")),
    actions,
    readings,
  },
  render: (args) => (
    <div className="max-w-200">
      <DecisionCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The cite and the fact that more than one engine was consulted are
    // readable without opening anything — principle 6 survives the collapse.
    await expect(canvas.getByText("AS READ")).toBeVisible();
    await expect(canvas.getByTestId("as-read-cite")).toHaveTextContent("p12");
    await expect(canvas.getByText(/Read by 2 engines/)).toBeVisible();
  },
};

/**
 * A DISAGREEMENT HAS NO RESTING STATE. The fold is the resting state of a
 * SETTLED reading; where the engines split, the two candidate strings ARE the
 * question, so the disclosure opens itself and the differing characters are
 * marked (`ux.spec` #2).
 */
export const TheFoldOpensOnDisagreement: Story = {
  args: { ...Disagreement.args },
  render: (args) => (
    <div className="max-w-200">
      <DecisionCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("gemini-2.5-flash")).toBeVisible();
    await expect(canvas.getAllByTestId("diff-hl").length).toBeGreaterThan(0);
  },
};

/** Agreement folds: one value, cited, and the detail stays one click away. */
export const AgreementFolds: Story = {
  args: {
    field: fieldAt("owner.zip"),
    statusLabel: stateLabel(fieldAt("owner.zip")),
    actions,
    readings,
  },
  render: (args) => (
    <div className="max-w-200">
      <DecisionCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("readings-disclosure")).not.toHaveAttribute("open");
  },
};

/**
 * ACTIONS ARE ABSENT FOR A ROLE THAT CANNOT ACT, never disabled. A greyed
 * decision is an invitation to ask for permission; an absent one is an answer —
 * and the card says WHY the buttons are missing rather than leaving a gap.
 *
 * The `Report pipeline bug` line this used to assert is gone (2026-07-30): the
 * export draws no such control and no product rule asks for one, so it was an
 * inert affordance pointing at nowhere. Its removal is the reason the assertion
 * below changed; the rule this story exists for — absent, not disabled — is
 * unchanged and still pinned.
 */
export const NoReviewRole: Story = {
  args: { ...Disagreement.args, actions: null },
  render: (args) => (
    <div className="max-w-200">
      <DecisionCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId("act-confirm")).not.toBeInTheDocument();
    await expect(
      canvas.getByText(/Review decisions belong to the reviewer on this order/),
    ).toBeVisible();
  },
};
