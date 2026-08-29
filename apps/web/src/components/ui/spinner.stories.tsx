import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Spinner } from "./spinner";
import { onPanel } from "./kitGround";

/**
 * TWO SIZES, TWO GROUNDS, AND ONE STORY THAT PINS THE REDUCED-MOTION
 * BEHAVIOUR — the defect the registry's `animate-spin` shipped.
 */
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
 * ON THE DARK CHROME. The ring is `currentColor` at two opacities, so the whole
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
 * RULE 10, MEASURED. The registry drew `animate-spin`, and the global
 * `prefers-reduced-motion` block clamps `animation-duration` to 0.01ms rather
 * than setting `animation: none` — deliberately, so a `transitionend` listener
 * still fires. A ROTATION under that clamp is not stopped, it is a strobe.
 *
 * This asserts the animation is the token file's own `tp-pulse`, an OPACITY
 * cycle, which under the same clamp settles at full opacity and simply sits
 * there. The check reads the computed animation name, so replacing the class
 * with a spin fails here.
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
 * THE LABEL IS ANNOUNCED, ONCE. `role="status"` is a polite live region on the
 * wrapper; the SVG inside is `aria-hidden`, so the ring is not read as a second
 * graphic beside the words.
 */
export const AnnouncesItsWait: Story = {
  play: ({ canvasElement }) => {
    const node = canvasElement.querySelector('[data-slot="spinner"]');
    expect(node?.getAttribute("role")).toBe("status");
    expect(node?.getAttribute("aria-label")).toBe("Uploading the package");
    expect(node?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  },
};
