import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageFacsimile } from "./PageFacsimile";
import { assertFacsimileThemeGate } from "./facsimileThemeGate";
import { SPECIMEN_PAGE, SPECIMEN_BOXES } from "../../entities/document/pageSpecimen";

/**
 * THE FIRST STORIES IN THIS REPO THAT RENDER UNDER `data-theme="mocha"`.
 *
 * `[data-theme="mocha"]` is an attribute selector, not a `:root` rule, so it
 * re-declares the token custom properties for ANY subtree it is set on. That
 * is what makes a two-up comparison possible: one story renders the same
 * component twice, in both registers, and measures both — which no single
 * theme-toggled screenshot can do. Copy this shape for any component whose
 * behaviour differs between themes.
 *
 * What it pins: THE DOCUMENT DOES NOT INVERT. A scan is a photograph of paper;
 * the surround darkens, the page stays light. The page shipped painted in
 * `bg-surface-panel`/`text-ink-primary` — UI-CHROME tokens — so in Mocha a
 * scanned county record rendered as a dark slab with light type.
 */

/**
 * The pane the facsimile really sits in — `surface-document`, which is NOT
 * pinned. Since the 2026-08-01 reskin it is the mockup viewer surround — a
 * warm near-black in BOTH themes; before that only Mocha darkened it.
 */
function Pane({ mocha, children }: { mocha?: boolean; children: React.ReactNode }) {
  const theme = mocha === true ? { "data-theme": "mocha" } : {};
  return (
    <div {...theme} className="bg-surface-document p-12">
      {children}
    </div>
  );
}

const meta = {
  title: "Review/PageFacsimile",
  component: PageFacsimile,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PageFacsimile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnPaper: Story = {
  args: { page: SPECIMEN_PAGE, boxes: SPECIMEN_BOXES },
  render: (args) => (
    <Pane>
      <PageFacsimile {...args} />
    </Pane>
  ),
};

export const OnPaperInMocha: Story = {
  args: { page: SPECIMEN_PAGE, boxes: SPECIMEN_BOXES },
  render: (args) => (
    <Pane mocha>
      <PageFacsimile {...args} />
    </Pane>
  ),
};

/**
 * THE GATE. Both registers on screen at once, measured.
 */
export const IdenticalInBothThemes: Story = {
  args: { page: SPECIMEN_PAGE, boxes: SPECIMEN_BOXES },
  render: (args) => (
    <>
      <Pane>
        <PageFacsimile {...args} />
      </Pane>
      <Pane mocha>
        <PageFacsimile {...args} />
      </Pane>
    </>
  ),
  play: ({ canvasElement }) => assertFacsimileThemeGate(canvasElement),
};

/**
 * A degraded microfilm frame must LOOK degraded — dimmed ink on paper, the way
 * a bad photocopy is. On the inverted page it dimmed LIGHT text on dark, which
 * reads as a cleaner scan rather than a worse one.
 */
export const Degraded: Story = {
  args: { page: { ...SPECIMEN_PAGE, degraded: true }, boxes: SPECIMEN_BOXES },
  render: (args) => (
    <Pane mocha>
      <PageFacsimile {...args} />
    </Pane>
  ),
};

/** Most pages of a county package carry nothing the report needs. */
export const NotReadInFull: Story = {
  args: { page: { ...SPECIMEN_PAGE, n: 41, read_in_full: false }, boxes: null },
  render: (args) => (
    <Pane mocha>
      <PageFacsimile {...args} />
    </Pane>
  ),
};
