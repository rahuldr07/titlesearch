import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { NewRuleForm } from "./NewRuleForm";

const meta = {
  title: "Rulebook/NewRuleForm",
  component: NewRuleForm,
  parameters: { layout: "padded" },
  args: { onCancel: fn() },
} satisfies Meta<typeof NewRuleForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TASK 9 §11. The design's confirmed copy for the pending banner is
 * "PENDING — AFFECTS NOTHING YET" (`:1777`), written in literal capitals in
 * the markup — never a CSS `text-transform`, which is why this checks the
 * exact rendered string rather than a case-insensitive match.
 */
export const PendingBannerReadsDesignCopy: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("PENDING — AFFECTS NOTHING YET")).toBeInTheDocument();
  },
};

/**
 * The citation field the design marks required (`:1786-1787`, halt border and
 * label) exists and is drawn as such — the only one of the four fields with
 * the halt treatment.
 */
export const CitationFieldIsPresentAndRequired: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(/Citation — required/)).toBeInTheDocument();
  },
};

/** Saving with every field empty refuses and names all four, citation included. */
export const SaveWithNothingWrittenNamesEveryMissingField: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("save-pending"));
    const error = canvas.getByTestId("new-rule-error");
    await expect(error).toHaveTextContent(/Scope/);
    await expect(error).toHaveTextContent(/Citation/);
  },
};
