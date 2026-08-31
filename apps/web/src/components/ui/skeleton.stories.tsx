import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./skeleton";
import { onPanel } from "./kitGround";

/**
 * Three heights matching three of the six type sizes, three widths, and one
 * story that states the refusal: a scan does not get a grey bar.
 */
const meta = {
  title: "ui/Skeleton",
  decorators: [onPanel],
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a full-width body line. */
export const Body: Story = { args: { height: "body", width: "full" } };

/** An 11px label line. */
export const LabelHeight: Story = { args: { height: "label", width: "quarter" } };

/** A 20px panel-title line. */
export const SubjectHeight: Story = { args: { height: "subject", width: "half" } };

/** Half width — a value still arriving next to a label that has landed. */
export const Half: Story = { args: { width: "half" } };

/** Quarter width — a short mono count. */
export const Quarter: Story = { args: { width: "quarter" } };

/** A loading row as a screen would actually assemble it. */
export const LoadingRow: Story = {
  render: () => (
    <div className="flex w-160 flex-col gap-6">
      <Skeleton height="subject" width="half" />
      <Skeleton height="body" />
      <Skeleton height="body" />
      <Skeleton height="label" width="quarter" />
    </div>
  ),
};

/**
 * What this component may not do: evidence renders as paper, never as grey
 * placeholder bars. The right-hand side is the defect, kept visible.
 */
export const NeverOnPaper: Story = {
  render: () => (
    <div className="flex gap-8">
      <div className="w-88 rounded-paper bg-surface-paper p-8 font-serif leading-document text-page-ink">
        Correct: the stock is there while the page loads, and the reader can see it is a
        document.
      </div>
      <div className="flex w-88 flex-col gap-6 rounded-paper bg-surface-paper p-8">
        <Skeleton height="body" />
        <Skeleton height="body" />
        <p className="font-sans text-label leading-flat text-state-halt">
          Defect — rule 8. A grey bar where a deed should be.
        </p>
      </div>
    </div>
  ),
};
