import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { SignoffReadonly } from "./SignoffReadonly";
import { SIGNED_SIGNOFF, UNSIGNED_SIGNOFF, signoffLine } from "./signoffFixture";

const meta = {
  title: "Signoff/SignoffReadonly",
  component: SignoffReadonly,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SignoffReadonly>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed: the badge, who signed it, the lines, the words — and not one control. */
export const Signed: Story = {
  args: { signoff: SIGNED_SIGNOFF },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("R. Delacroix (abstractor)")).toBeInTheDocument();
    await expect(
      canvas.getByText(/No plat or survey was in the package/),
    ).toBeInTheDocument();
    // CONTRACT GAP: no amendment endpoint. A control over a signed, append-only
    // record offers an act the server cannot accept.
    await expect(canvas.queryAllByRole("button")).toHaveLength(0);
    await expect(canvas.queryAllByRole("radio")).toHaveLength(0);
    await expect(canvas.queryAllByRole("textbox")).toHaveLength(0);
  },
};

/**
 * THE COUNT BUG THIS COMPONENT EXISTS TO NOT REPRODUCE. Three lines exist and
 * all three are answered, so the footer may say three — but it says it because
 * it counted answers, and the next story proves it.
 */
export const FooterCountsAnsweredLines: Story = {
  args: { signoff: SIGNED_SIGNOFF },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("3 of 3 answered · 1 disclosed as NO."),
    ).toBeInTheDocument();
  },
};

/** Two of three answered: `lines.length` would have claimed three. */
export const PartiallyAnswered: Story = {
  args: {
    signoff: {
      ...SIGNED_SIGNOFF,
      lines: [
        signoffLine(1),
        signoffLine(2, {
          answer: "NO",
          comment: "Package is short the 1994 assignment.",
        }),
        signoffLine(3, { answer: null }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("2 of 3 answered · 1 disclosed as NO."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("NOT ANSWERED")).toBeInTheDocument();
  },
};

/**
 * Unsigned: nothing is answered, so the block claims no number at all. Policy
 * has an opinion on every line and the block names it as a suggestion — the
 * line is unsigned until a person answers it (ruling Q13).
 */
export const UnsignedPolicyPrefill: Story = {
  args: { signoff: UNSIGNED_SIGNOFF },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("No line has been answered — nothing here is signed."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("NOT SIGNED · POLICY PREFILL")).toBeInTheDocument();
    await expect(
      canvas.getByText(/Policy can suggest; only a person can sign/),
    ).toBeInTheDocument();
  },
};

/**
 * The admissible answers are the LINE'S. Two of these lines are YES/NO only and
 * one admits N/A, and the block never offers N/A on the other two.
 */
export const AdmissibleAnswersAreThelines: Story = {
  args: { signoff: UNSIGNED_SIGNOFF },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("MAY BE ANSWERED")).toHaveLength(3);
    await expect(canvas.getAllByText("YES · NO")).toHaveLength(2);
    await expect(canvas.getByText("YES · NO · N/A")).toBeInTheDocument();
  },
};

/** A NO recorded with no comment is a visible defect, not a quiet blank. */
export const NoWithoutItsComment: Story = {
  args: {
    signoff: {
      ...SIGNED_SIGNOFF,
      lines: [signoffLine(2, { answer: "NO", comment: null, comment_required: true })],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("NO recorded with no comment")).toBeInTheDocument();
  },
};
