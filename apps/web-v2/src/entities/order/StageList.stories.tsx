import type { Meta, StoryObj } from "@storybook/react-vite";
import { StageList } from "./StageList";

const meta = {
  title: "Order/StageList",
  component: StageList,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StageList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Phase comes from the SERVER — conflict C3 records the export computing
 * `done/gate/wait` in the browser, which constraint 9 forbids. There is no
 * ordering logic in this component, not even "the stage after a halted one is
 * waiting".
 *
 * The pulse is never the only signal: every stage carries its phase as text in
 * the badge, so a reader who cannot see motion — or who has
 * prefers-reduced-motion set, which kills the animation globally — gets the
 * same information.
 */
export const TwoHaltsByDesign: Story = {
  args: {
    stages: [
      {
        id: "intake",
        title: "Intake sign-off",
        detail: "Thirteen lines answered and signed.",
        phase: "done",
        stoppedOn: "the abstractor",
      },
      {
        id: "segment",
        title: "Segment",
        detail: "64 pages in the package, 11 read in full.",
        phase: "done",
        stoppedOn: "the machine",
      },
      {
        id: "gate",
        title: "Completeness gate",
        detail: "Two instruments referenced but not segmented.",
        phase: "halted",
        stoppedOn: "a person",
      },
      {
        id: "extract",
        title: "Extract",
        detail: "Nothing has been extracted yet, so re-running costs nothing.",
        phase: "waiting",
        stoppedOn: "the completeness gate",
      },
      {
        id: "review",
        title: "Review",
        detail: "132 fields, 18 flagged for a decision.",
        phase: "waiting",
        stoppedOn: "a reviewer",
      },
      {
        id: "deliver",
        title: "Deliver",
        detail: "Not started.",
        phase: "waiting",
        stoppedOn: "review",
      },
    ],
  },
  render: (args) => (
    <div className="max-w-160">
      <StageList {...args} />
    </div>
  ),
};

export const AwaitingAPerson: Story = {
  args: {
    stages: [
      {
        id: "extract",
        title: "Extract",
        detail: "132 fields extracted.",
        phase: "done",
        stoppedOn: "the machine",
      },
      {
        id: "review",
        title: "Review",
        detail: "18 fields need a decision.",
        phase: "gate",
        stoppedOn: "a reviewer",
      },
      {
        id: "deliver",
        title: "Deliver",
        detail: "Not started.",
        phase: "waiting",
        stoppedOn: "review",
      },
    ],
  },
  render: (args) => (
    <div className="max-w-160">
      <StageList {...args} />
    </div>
  ),
};

export const AllDone: Story = {
  args: {
    stages: [
      {
        id: "review",
        title: "Review",
        detail: "Every field decided.",
        phase: "done",
        stoppedOn: "nobody",
      },
      {
        id: "deliver",
        title: "Deliver",
        detail: "Delivered 07/24/2026. Both versions retained.",
        phase: "done",
        stoppedOn: "nobody",
      },
    ],
  },
  render: (args) => (
    <div className="max-w-160">
      <StageList {...args} />
    </div>
  ),
};
