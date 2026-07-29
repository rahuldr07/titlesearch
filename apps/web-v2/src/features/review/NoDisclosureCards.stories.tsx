import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OrderSignoffLine } from "@titlepipe/contract";
import { expect, within } from "storybook/test";
import { NoDisclosureCards } from "./NoDisclosureCards";

const LINES: readonly OrderSignoffLine[] = [
  {
    line_id: "L4",
    n: 4,
    label: "Open mortgages and deeds of trust reported",
    group: "Liens",
    answer: "YES",
    comment: null,
    comment_required: true,
    machine_check: "Security instruments extracted",
    period_scoped: false,
    prefilled_from_policy: false,
  },
  {
    line_id: "L11",
    n: 11,
    label: "Easements and restrictions of record reported",
    group: "Legal",
    answer: "NO",
    comment: "No plat or survey was in the package — only prior deed exhibits could be checked for easement language.",
    comment_required: true,
    machine_check: null,
    period_scoped: false,
    prefilled_from_policy: false,
  },
];

const meta = {
  title: "Review/NoDisclosureCards",
  component: NoDisclosureCards,
  parameters: { layout: "padded" },
} satisfies Meta<typeof NoDisclosureCards>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TASK 9 §11. The design's `:942-961` card — one per sign-off line answered
 * NO, quoting the abstractor's own comment. Sourced from the real sign-off
 * endpoint (`orderSignoffQuery`), never invented: a YES line never renders a
 * card, and the quote is the exact `comment` string.
 */
export const OneCardPerNoLine: Story = {
  args: { lines: LINES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("no-disclosure-L11")).toBeInTheDocument();
    await expect(canvas.queryByTestId("no-disclosure-L4")).not.toBeInTheDocument();
    await expect(canvas.getByText(/No plat or survey was in the package/)).toBeInTheDocument();
    await expect(canvas.getByText("Sign-off line 11 · Easements and restrictions of record reported")).toBeInTheDocument();
  },
};

/**
 * The accept/escalate controls stay visible and disabled — no endpoint
 * accepts or escalates a disclosure yet.
 */
export const ControlsAreDisabled: Story = {
  args: { lines: LINES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Accept as stated/ })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: /Escalate/ })).toBeDisabled();
  },
};

/** No NO lines at all — the panel renders nothing, not an empty shell. */
export const NoDisclosuresRendersNothing: Story = {
  args: { lines: LINES.filter((line) => line.answer !== "NO") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/Disclosure/)).not.toBeInTheDocument();
  },
};
