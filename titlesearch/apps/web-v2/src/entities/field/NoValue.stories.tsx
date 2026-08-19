import type { Meta, StoryObj } from "@storybook/react-vite";
import { NoValue } from "./NoValue";

const meta = {
  title: "Field/NoValue",
  component: NoValue,
  parameters: { layout: "padded" },
} satisfies Meta<typeof NoValue>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * All six, together, because the rule is about the SET: "They must never
 * collapse into one grey dash" (CONTEXT §11, and the design's own States
 * Gallery). Each differs in border style or fill pattern as well as colour, so
 * the distinction survives greyscale printing and colour-blindness.
 *
 * Print this story in greyscale to check the rule still holds.
 */
export const AllSix: Story = {
  args: { value: { kind: "pending" } },
  render: () => (
    <div className="flex flex-col items-start gap-6">
      <NoValue value={{ kind: "pending" }} />
      <NoValue value={{ kind: "unsettled" }} />
      <NoValue value={{ kind: "not_present" }} />
      <NoValue value={{ kind: "not_found" }} />
      <NoValue value={{ kind: "silent" }} />
      <NoValue value={{ kind: "unreadable", page: 47 }} />
    </div>
  ),
};

/**
 * The four that are statements about the DOCUMENT. These are answers — the
 * field was looked at and this is what the page says.
 */
export const DocumentStates: Story = {
  args: { value: { kind: "not_present" } },
  render: () => (
    <div className="flex flex-col items-start gap-6">
      <NoValue value={{ kind: "not_present" }} />
      <NoValue value={{ kind: "not_found" }} />
      <NoValue value={{ kind: "silent" }} />
      <NoValue value={{ kind: "unreadable", page: 47 }} />
    </div>
  ),
};

/**
 * The two that are statements about the PIPELINE — the absence of an answer.
 * Neither is drawn by the design.
 *
 * `pending` is a recorded gap (state-coverage.md §2.1). `unsettled` was found
 * on screen during the previous rebuild: the contract encodes it identically to
 * `pending`, and rendering it as "nothing here" would tell a reviewer there is
 * nothing to look at while two candidate readings sit in the payload. Both take
 * the attend treatment because both are waiting on someone.
 */
export const PipelineStates: Story = {
  args: { value: { kind: "pending" } },
  render: () => (
    <div className="flex flex-col items-start gap-6">
      <NoValue value={{ kind: "pending" }} />
      <NoValue value={{ kind: "unsettled" }} />
    </div>
  ),
};
