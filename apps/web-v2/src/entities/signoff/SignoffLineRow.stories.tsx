import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { DividedSection } from "../../shared/ui/ListRow";
import { SignoffLineRow } from "./SignoffLineRow";
import { signoffLine } from "./signoffFixture";

const meta = {
  title: "Signoff/SignoffLineRow",
  component: SignoffLineRow,
  parameters: { layout: "padded" },
  // The row is an `<li>`; a bare `<li>` outside a list is an a11y violation and
  // the addon runs at `error`, so the story supplies the list it belongs to.
  decorators: [
    (Story) => (
      <DividedSection>
        <Story />
      </DividedSection>
    ),
  ],
} satisfies Meta<typeof SignoffLineRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Answered YES: the record, and nothing about what it might have been. */
export const Answered: Story = {
  args: {
    line: signoffLine(1, { label: "Chain of title searched for the ordered period" }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("L01")).toBeInTheDocument();
    await expect(canvas.getByText("YES")).toBeInTheDocument();
    await expect(canvas.queryByText("MAY BE ANSWERED")).not.toBeInTheDocument();
  },
};

/** A NO carries the abstractor's own words, quoted and never paraphrased. */
export const NoWithItsComment: Story = {
  args: {
    line: signoffLine(2, {
      label: "Easements and restrictions of record reported",
      answer: "NO",
      comment: "No plat or survey was in the package.",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/No plat or survey was in the package\./),
    ).toBeInTheDocument();
  },
};

/** Unanswered: dashed edge, the line's own admissible set, the suggestion. */
export const Unanswered: Story = {
  args: {
    line: signoffLine(3, {
      answer: null,
      answers: ["YES", "NO", "N/A"],
      prefilled_from_policy: true,
      policy_suggestion: "N/A",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("NOT ANSWERED")).toBeInTheDocument();
    await expect(canvas.getByText("YES · NO · N/A")).toBeInTheDocument();
    await expect(canvas.getByText("N/A")).toBeInTheDocument();
    await expect(canvas.getByText(/only a person can sign it/)).toBeInTheDocument();
  },
};

/**
 * CONTRACT GAP, drawn so it is not forgotten: no endpoint records an amendment
 * to a signed answer, and none records that a line contradicts extraction. The
 * two sub-states exist as props and no call site can supply them yet.
 */
export const AmendedAndRaised: Story = {
  args: {
    line: signoffLine(6, {
      label: "Judgments and liens searched against every vested owner",
    }),
    amendedFrom: "N/A",
    raised: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("AMENDED FROM N/A → YES · RECORDED"),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("CONTRADICTS EXTRACTION — RAISED AS A DECISION ABOVE"),
    ).toBeInTheDocument();
  },
};
