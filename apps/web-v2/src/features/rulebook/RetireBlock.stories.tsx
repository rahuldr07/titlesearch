import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { RetireBlock } from "./RetireBlock";

const meta = {
  title: "Rulebook/RetireBlock",
  component: RetireBlock,
  parameters: { layout: "padded" },
} satisfies Meta<typeof RetireBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TASK 9. The design draws two states for the armed retire preview —
 * `hasRetireImpact` (golden-set numbers) and `noRetireImpact` ("No retire
 * preview has been run for this rule, so what reverts is unknown") — and
 * requires the absence to be STATED, never a silent gap. `Rule` carries no
 * impact field and no endpoint has ever run a preview, so every real rule
 * takes the second branch; this is what `arm-retire` must always reveal.
 */
export const RetirePreviewStatesItsAbsence: Story = {
  args: { mayRetire: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("arm-retire"));
    const preview = canvas.getByTestId("retire-preview");
    await expect(preview).toHaveTextContent(
      /no retire preview has been run|what reverts is unknown/i,
    );
    // The confirm control stays inert — no retire endpoint exists.
    await expect(
      canvas.getByRole("button", { name: /Confirm.*RETIRE/ }),
    ).toBeDisabled();
  },
};

/** Retiring is restricted to engineer and admin — the control is absent for anyone else. */
export const RestrictedRoleSeesNoRetireControl: Story = {
  args: { mayRetire: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId("arm-retire")).not.toBeInTheDocument();
    await expect(
      canvas.getByText(/restricted to engineer and admin/),
    ).toBeInTheDocument();
  },
};
