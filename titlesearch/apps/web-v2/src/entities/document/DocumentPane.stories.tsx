import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentPane } from "./DocumentPane";
import { SYNTHETIC_PAGE_SRC, SYNTHETIC_BOXES } from "./pageFixture";

const meta = {
  title: "Document/DocumentPane",
  component: DocumentPane,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DocumentPane>;

export default meta;
type Story = StoryObj<typeof meta>;

const base = {
  pageSrc: SYNTHETIC_PAGE_SRC,
  page: 3,
  readInFull: true,
  snippet: "…LENDER: SPECIMEN LENDING CO (FIXTURE)… AMOUNT: $000,000.00…",
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="h-200">{children}</div>
);

/** The flagship case: page read in full, coordinates declared, boxes drawn. */
export const WithEvidence: Story = {
  args: { ...base, boxes: SYNTHETIC_BOXES },
  render: (args) => (
    <Frame>
      <DocumentPane {...args} />
    </Frame>
  ),
};

/**
 * An engine that declared NO coordinates gets no overlay and the snippet
 * instead — never a faked box (`leaderboard.spec` #2, declared-not-faked). The
 * cited-text label says so explicitly, so a screen-reader user is not left to
 * infer it from a rectangle they cannot see.
 */
export const NoCoordinatesDeclared: Story = {
  args: { ...base, boxes: null },
  render: (args) => (
    <Frame>
      <DocumentPane {...args} />
    </Frame>
  ),
};

/**
 * Most pages are never captured in full — CONTEXT §5 puts median text-layer
 * coverage well under 25%. This is a normal state, and it must never render as
 * a blank pane, which would read as "nothing here".
 */
export const NotReadInFull: Story = {
  args: { ...base, page: 41, readInFull: false, boxes: null },
  render: (args) => (
    <Frame>
      <DocumentPane {...args} />
    </Frame>
  ),
};

/**
 * The dark register. Per decisions.md D2 (reversed by the owner) Review ships
 * the light pane as drawn; the three measurement screens keep this one.
 */
export const DarkSurround: Story = {
  args: { ...base, boxes: SYNTHETIC_BOXES, surround: "dark" },
  render: (args) => (
    <Frame>
      <DocumentPane {...args} />
    </Frame>
  ),
};

/** A degraded microfilm frame takes the heavier scan filter. */
export const DegradedScan: Story = {
  args: { ...base, boxes: SYNTHETIC_BOXES, degraded: true, surround: "dark" },
  render: (args) => (
    <Frame>
      <DocumentPane {...args} />
    </Frame>
  ),
};
