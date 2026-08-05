import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CensusTile } from "./CensusTile";

const meta = {
  title: "Primitives/CensusTile",
  component: CensusTile,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CensusTile>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * These assert the CLASS the tile emits, not its computed style. Storybook
 * builds with its own Vite config and does not carry `@tailwindcss/vite`, so
 * no utility and no token resolves in this harness — a `getComputedStyle`
 * assertion here would read the browser default and pass or fail for reasons
 * that have nothing to do with the component.
 */
const numeralOf = (el: HTMLElement) => el.className;

/**
 * EVERY FIGURE HERE IS A CENSUS — how many are sitting where, right now. None
 * is a rate, a throughput, an average or a target (§4.5). The name is the
 * guard: a rate-shaped prop on something called CensusTile is obviously wrong.
 */
export const Board: Story = {
  args: { value: 12, caption: "Orders in flight" },
  render: () => (
    <div className="flex">
      <CensusTile value={12} caption="Orders in flight" edge />
      <CensusTile value={7} caption="Stopped on a person" tone="action" edge />
      <CensusTile value={1} caption="Off the pipeline" tone="halt" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Mono, because these get compared against a package a person is holding,
    // and a 1 beside a 7 stops lining up the moment a figure changes width.
    const plain = await canvas.findByText("12");
    expect(numeralOf(plain)).toContain("font-mono");
    expect(numeralOf(plain)).toContain("text-3xl");
    // Untoned is the LOUDEST ink: on a census tile the figure is the content.
    expect(numeralOf(plain)).toContain("text-ink-primary");

    // Violet means "waiting on a person" — normal operation, not an alarm.
    // Only the off-pipeline figure, which no stage will move, is drawn as one.
    expect(numeralOf(await canvas.findByText("7"))).toContain("text-action");
    const failed = await canvas.findByText("1");
    expect(numeralOf(failed)).toContain("text-state-halt-ink");

    // `edge` is the divider BETWEEN tiles, so the last one never draws one.
    const lastTile = failed.parentElement as HTMLElement;
    expect(lastTile.className).not.toContain("border-r");
  },
};

/** The chrome strip's tier — 15px mono (decision D10), same component. */
export const Strip: Story = {
  args: { value: 4, caption: "Need you", size: "strip" },
  render: () => (
    <div className="flex gap-6">
      <CensusTile value={4} caption="Need you" tone="action" size="strip" />
      <CensusTile value={0} caption="No source" tone="muted" size="strip" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const numeral = await canvas.findByText("4");
    expect(numeralOf(numeral)).toContain("text-census");
    expect(numeralOf(numeral)).toContain("font-mono");
    // The strip rides in the chrome, which sets its own rhythm around it.
    expect((numeral.parentElement as HTMLElement).className).not.toContain("px-8");

    // `muted` has to actually recede, or NO SOURCE out-shouts NEED YOU — the
    // tile that is actionable. An untoned tile is the loud one, not this.
    expect(numeralOf(await canvas.findByText("0"))).toContain("text-ink-muted");
  },
};

/**
 * The tone axis end to end. `muted` is a deliberate recession, not the absence
 * of a tone — the untoned figure is the strongest ink on the tile, because on a
 * census tile the figure is the content.
 */
export const Tones: Story = {
  args: { value: 3, caption: "Pending" },
  render: () => (
    <div className="flex">
      <CensusTile value={38} caption="Pages in package" edge />
      <CensusTile value={11} caption="Read in full" tone="action" edge />
      <CensusTile value={9} caption="Live" tone="settled" edge />
      <CensusTile value={3} caption="Pending" tone="attend" edge />
      <CensusTile value={2} caption="No source" tone="halt" edge />
      <CensusTile value={17} caption="Retired" tone="muted" />
    </div>
  ),
};
