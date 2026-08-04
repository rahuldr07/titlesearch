import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageStrip } from "./PageStrip";

const meta = {
  title: "Document/PageStrip",
  component: PageStrip,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PageStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The ratio is the honest part. A strip showing only the captured pages with no
 * denominator implies the rest do not exist — CONTEXT §5 puts median text-layer
 * coverage well under 25%, so the gap is the normal case. Both numbers are
 * server-supplied; the client does not count pages.
 */
export const ElevenOfSixtyFour: Story = {
  args: {
    pages: [1, 3, 7, 9, 12, 18, 24, 31, 40, 47, 58],
    totalPages: 64,
    currentPage: 47,
    onSelect: () => {},
  },
};

export const SinglePage: Story = {
  args: { pages: [1], totalPages: 36, currentPage: 1, onSelect: () => {} },
};

/** Nothing captured. Says so in words rather than rendering an empty row. */
export const NoneReadInFull: Story = {
  args: { pages: [], totalPages: 181, currentPage: 1, onSelect: () => {} },
};
