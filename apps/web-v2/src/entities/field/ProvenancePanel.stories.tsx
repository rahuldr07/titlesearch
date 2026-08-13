import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProvenancePanel } from "./ProvenancePanel";

const meta = {
  title: "Field/ProvenancePanel",
  component: ProvenancePanel,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ProvenancePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All four parts of provenance: document, page, snippet, coordinates. */
export const Complete: Story = {
  args: {
    documentName: "Security deed 09812/44",
    page: 3,
    snippet: "…SPECIMEN LENDING CO (FIXTURE), a corporation organised under…",
    hasCoordinates: true,
  },
  render: (args) => (
    <div className="max-w-160">
      <ProvenancePanel {...args} />
    </div>
  ),
};

/**
 * The fourth part is the one usually forgotten. An engine that declared no
 * coordinates is not the same as one that did, and saying so stops a reviewer
 * assuming the pane is broken when no highlight appears.
 */
export const NoCoordinatesDeclared: Story = {
  args: {
    documentName: "FiFa search, p 31",
    page: 31,
    snippet: "…NOTICE OF LIS PENDENS, filed against the above-named…",
    hasCoordinates: false,
  },
  render: (args) => (
    <div className="max-w-160">
      <ProvenancePanel {...args} />
    </div>
  ),
};
