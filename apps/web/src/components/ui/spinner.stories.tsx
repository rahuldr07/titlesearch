import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Spinner } from "./spinner";
import { onPanel } from "./kitGround";

/** Two sizes, two grounds, and one story that pins the reduced-motion behaviour. */
const meta = {
  title: "ui/Spinner",
  decorators: [onPanel],
  component: Spinner,
  args: { label: "Uploading the package" },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inside a button's label row. The default. */
export const Small: Story = { args: { size: "sm" } };

/** Standing alone in a pane. */
export const Medium: Story = { args: { size: "md" } };

/** The label says WHICH wait this is, not "Loading". */
export const InContext: Story = {
  render: () => (
    <div className="flex items-center gap-5 font-sans text-meta leading-close text-ink-secondary">
      <Spinner label="Reading the queue" />
      Reading the queue
    </div>
  ),
};

/**
 * On the dark chrome. The ring is `currentColor` at two opacities, so the
 * component takes the surrounding ink and needs no rail-specific prop.
 */
export const OnRail: Story = {
  parameters: { backgrounds: { value: "rail" } },
  decorators: [
    (Story) => (
      <div className="bg-rail-surface p-12 text-rail-ink-muted">
        <Story />
      </div>
    ),
  ],
  args: { size: "md" },
};

/**
 * The global prefers-reduced-motion block clamps animation-duration to
 * 0.01ms rather than setting `animation: none`, so a rotation under that
 * clamp is a strobe, not a stop. This asserts the animation is `tp-pulse`,
 * an opacity cycle that settles at full opacity under the same clamp.
 */
export const ReducedMotionSettlesRatherThanStrobes: Story = {
  play: ({ canvasElement }) => {
    const node = canvasElement.querySelector('[data-slot="spinner"]');
    expect(node).not.toBeNull();
    if (node === null) return;
    const name = getComputedStyle(node).animationName;
    expect(name).toBe("tp-pulse");
  },
};

/**
 * The label is announced once: `role="status"` is a polite live region on
 * the wrapper, and the SVG inside is aria-hidden so the ring is not read as
 * a second graphic beside the words.
 */
export const AnnouncesItsWait: Story = {
  play: ({ canvasElement }) => {
    const node = canvasElement.querySelector('[data-slot="spinner"]');
    expect(node?.getAttribute("role")).toBe("status");
    expect(node?.getAttribute("aria-label")).toBe("Uploading the package");
    expect(node?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  },
};
