import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OrderSignoffLine } from "@titlepipe/contract";
import { expect, within } from "storybook/test";
import { demoFields } from "@titlepipe/mocks";
import { FinalizeBar } from "./FinalizeBar";

const NO_LINE: OrderSignoffLine = {
  line_id: "L11",
  n: 11,
  label: "Easements and restrictions of record reported",
  group: "Legal",
  answer: "NO",
  comment: "No plat or survey was in the package.",
  comment_required: true,
  machine_check: null,
  period_scoped: false,
  prefilled_from_policy: false,
};

const ALL_ANSWERED_FIELDS = demoFields.map((f) =>
  f.state === "needs_review" ? { ...f, state: "confirmed" as const } : f,
);

const meta = {
  title: "Review/FinalizeBar",
  component: FinalizeBar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FinalizeBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TASK 9. `demoFields` carries 12 confirmed + 6 needs_review = 18 fields the
 * pipeline ever flagged (same tally `DecisionDock` shows), 6 still open. With
 * no NO lines, the note names only the decisions and the button stays
 * disabled — no finalize/deliver endpoint exists in the contract.
 */
export const NamesOpenDecisions: Story = {
  args: { fields: demoFields, signoffLines: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("finalize-note")).toHaveTextContent(
      "6 decisions still need you. Finalize stays disabled until each is resolved.",
    );
    await expect(canvas.getByTestId("finalize-order-btn")).toBeDisabled();
  },
};

/**
 * REVIEW FIX. Every field decision answered, but one sign-off line is still
 * an open NO disclosure — the design's gate is `allAnswered && openNo === 0`
 * (`:3227`), so this must NOT read "ready", and the note must name the
 * disclosure, not just the (zero) decisions. Regression guard for the finding
 * that `FinalizeBar` used to ignore `signoffLines` entirely.
 */
export const OpenDisclosureBlocksEvenWhenAllDecisionsAnswered: Story = {
  args: { fields: ALL_ANSWERED_FIELDS, signoffLines: [NO_LINE] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const note = canvas.getByTestId("finalize-note");
    await expect(note).toHaveTextContent(
      "1 NO disclosure still need you. Finalize stays disabled until each is resolved.",
    );
    await expect(note).not.toHaveTextContent(/resolved\. Ready to render/);
  },
};

/** Both kinds of open work are named together, in the design's order. */
export const NamesBothDecisionsAndDisclosures: Story = {
  args: { fields: demoFields, signoffLines: [NO_LINE] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("finalize-note")).toHaveTextContent(
      "6 decisions and 1 NO disclosure still need you. Finalize stays disabled until each is resolved.",
    );
  },
};

/** Every flagged decision answered AND every NO disclosure — the ready copy, verbatim. */
export const AllResolvedReadsReadyCopy: Story = {
  args: { fields: ALL_ANSWERED_FIELDS, signoffLines: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("finalize-note")).toHaveTextContent(
      "All decisions and disclosures resolved. Ready to render and deliver.",
    );
  },
};
