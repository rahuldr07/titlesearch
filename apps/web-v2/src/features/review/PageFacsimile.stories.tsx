import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { PageFacsimile } from "./PageFacsimile";
import { luminance } from "../../entities/document/luminance";
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
 * pinned: the surround is exactly the thing that is allowed to darken.
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
  play: async ({ canvasElement }) => {
    const inks = [...canvasElement.querySelectorAll("figure pre")];
    await expect(inks).toHaveLength(2);
    const sheets = inks.map((pre) => pre.parentElement as HTMLElement);
    const panes = inks.map((pre) => pre.closest("div.bg-surface-document") as HTMLElement);

    // VACUITY GUARD. If `data-theme` ever stops taking effect, every assertion
    // below would pass by rendering the light theme twice. The SURROUND is the
    // thing that must differ — it is the half of the rule nobody disputed.
    const surrounds = panes.map((p) => getComputedStyle(p).backgroundColor);
    console.log("DBG panes", panes.map((p) => p.className), surrounds, sheets.map((s) => getComputedStyle(s).backgroundColor), inks.map((i) => getComputedStyle(i).color));
    await expect(surrounds[0]).not.toEqual(surrounds[1]);
    await expect(luminance(surrounds[1] ?? "")).toBeLessThan(0.1);

    for (const sheet of sheets) {
      await expect(luminance(getComputedStyle(sheet).backgroundColor)).toBeGreaterThan(0.8);
    }
    for (const ink of inks) {
      await expect(luminance(getComputedStyle(ink).color)).toBeLessThan(0.05);
    }

    // Not merely "both light" — the SAME light. The page is one artefact.
    await expect(getComputedStyle(sheets[0] as HTMLElement).backgroundColor).toEqual(
      getComputedStyle(sheets[1] as HTMLElement).backgroundColor,
    );

    // The citation marker is the most load-bearing mark in the product. A
    // blend mode makes it depend on the ground beneath it; multiply over a
    // dark ground turned it into a redaction bar.
    const marks = [...canvasElement.querySelectorAll("[aria-hidden] span")];
    await expect(marks).toHaveLength(2);
    for (const mark of marks) {
      await expect(getComputedStyle(mark).mixBlendMode).toEqual("normal");
    }
    await expect(getComputedStyle(marks[0] as Element).backgroundColor).toEqual(
      getComputedStyle(marks[1] as Element).backgroundColor,
    );
  },
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
