import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardBody, CardHeader, InnerPanel } from "./card";
import { onCanvas } from "./kitGround";

/**
 * A card lives on the canvas, not on a panel — onCanvas is the surface that
 * makes its shadow and border mean anything.
 */
const meta = {
  title: "ui/Card",
  decorators: [onCanvas],
  component: Card,
  args: { children: "Content" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: white, raised, 24px padding. */
export const Raised: Story = {
  args: {
    children: (
      <p className="font-sans text-meta leading-body text-ink-primary">
        Harris County, warranty deed, recorded 12 March 2024.
      </p>
    ),
  },
};

/** A hairline edge instead of depth. Never both. */
export const Hairline: Story = {
  args: {
    edge: "hairline",
    children: (
      <p className="font-sans text-meta leading-body text-ink-primary">
        A quieter card.
      </p>
    ),
  },
};

/** Sunken: a well, a table cap, an inset track. */
export const Sunken: Story = {
  args: {
    tone: "sunken",
    edge: "hairline",
    children: (
      <p className="font-sans text-meta leading-body text-ink-secondary">
        An inset well.
      </p>
    ),
  },
};

/** Evidence and deliverables are paper, not a UI surface. */
export const Paper: Story = {
  args: {
    tone: "paper",
    edge: "none",
    children: (
      <p className="leading-document">
        Know all men by these presents, that the undersigned, for good and valuable
        consideration, does hereby grant and convey.
      </p>
    ),
  },
};

/** Tight padding — 16px, the low end of the 16–24 range. */
export const TightPadding: Story = {
  args: {
    padding: "tight",
    children: (
      <p className="font-sans text-meta leading-body text-ink-primary">Denser.</p>
    ),
  },
};

/** The header-plus-rows shape. */
export const WithHeader: Story = {
  args: {
    padding: "none",
    children: (
      <>
        <CardHeader>
          <span>Chain of title</span>
          <span className="font-mono">6 instruments</span>
        </CardHeader>
        <CardBody>
          <p className="font-sans text-meta leading-body text-ink-primary">
            Delgado to Delgado Family Trust, 12 March 2024.
          </p>
        </CardBody>
      </>
    ),
  },
};

/** The legal nesting: a card holding 10px inner panels. */
export const WithInnerPanels: Story = {
  args: {
    children: (
      <div className="flex flex-col gap-8">
        <InnerPanel tone="sunken" padding="tight">
          <p className="font-sans text-meta leading-body text-ink-primary">Reading A</p>
        </InnerPanel>
        <InnerPanel tone="sunken" padding="tight">
          <p className="font-sans text-meta leading-body text-ink-primary">Reading B</p>
        </InnerPanel>
      </div>
    ),
  },
};
