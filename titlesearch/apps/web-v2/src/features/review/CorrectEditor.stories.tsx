import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CorrectEditor } from "./CorrectEditor";

const meta = {
  title: "Review/CorrectEditor",
  component: CorrectEditor,
  parameters: { layout: "padded" },
  args: {
    seed: "SOUTHSTONE MORTGAGE",
    machineValue: "S0UTHST0NE M0RTGAGE",
    pending: false,
    onCancel: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof CorrectEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const fill = async (canvas: ReturnType<typeof within>) => {
  await userEvent.clear(canvas.getByTestId("edit-reason"));
  await userEvent.type(canvas.getByTestId("edit-reason"), "page reads SOUTHSTONE");
};

/** A changed value plus its reason is a correction, and it submits once. */
export const ValueAndReasonSubmits: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await fill(canvas);
    await userEvent.click(canvas.getByTestId("edit-submit"));
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

/**
 * BLOCKER 2. Three clicks on `edit-submit` under 4s latency filed THREE
 * correction records — three reason rows for one reviewer act, in the table
 * that feeds the rule channel. The submit is inert while the write is in
 * flight; a second click is not a second decision.
 */
export const PendingSubmitIsInert: Story = {
  args: { pending: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await fill(canvas);
    await expect(canvas.getByTestId("edit-submit")).toBeDisabled();
    await userEvent.click(canvas.getByTestId("edit-submit"), { pointerEventsCheck: 0 });
    await userEvent.click(canvas.getByTestId("edit-submit"), { pointerEventsCheck: 0 });
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/**
 * The DISABLED attribute is the courtesy; the guard is the enforcement. Enter
 * commits from inside the field and never touches the button, so a keyboard
 * reviewer could file the same three records without a single click.
 */
export const PendingEnterFilesNothing: Story = {
  args: { pending: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await fill(canvas);
    const reason = canvas.getByTestId("edit-reason");
    await userEvent.type(reason, "{Enter}{Enter}{Enter}");
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
