import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ExcludeEditor } from "./ExcludeEditor";

const meta = {
  title: "Review/ExcludeEditor",
  component: ExcludeEditor,
  parameters: { layout: "padded" },
  args: { pending: false, onCancel: fn(), onSubmit: fn() },
} satisfies Meta<typeof ExcludeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const REASON = "middle initial differs and the address is a different county";

/** A reason is a suppression, and Enter files it once. */
export const ReasonSubmits: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByTestId("exclude-reason"), `${REASON}{Enter}`);
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

/**
 * BLOCKER 2. This editor commits on Enter and has no button to disable, so
 * held or repeated Enter was an unguarded repeat-submit path. An excluded row
 * is GONE (`conflicts.md` C18) — filing the suppression three times writes
 * three records of one act onto the only evidence that a person decided.
 */
export const PendingEnterFilesNothing: Story = {
  args: { pending: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByTestId("exclude-reason"),
      `${REASON}{Enter}{Enter}`,
    );
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
