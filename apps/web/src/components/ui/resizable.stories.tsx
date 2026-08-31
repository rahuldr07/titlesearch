import type { Meta, StoryObj } from "@storybook/react-vite";
import { Split, SplitHandle, SplitPanel } from "./resizable";
import { DECISION_MAX, DECISION_MIN } from "./splitBand";
import { ScrollArea } from "./scroll-area";
import { onPanel } from "./kitGround";
import { Frame, Decision, Evidence } from "./splitStoryData";

/**
 * The workstation split, as geometry: the band at both ends and at rest,
 * both orientations, and the assembly the screen actually builds — two panes
 * each scrolling internally inside a frame that does not. The invisible
 * behaviours are proved in resizable.a11y.stories.tsx.
 */
const meta = {
  title: "ui/Split",
  decorators: [onPanel],
  component: Split,
  args: { children: null },
} satisfies Meta<typeof Split>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The design's split, at its 50/50 rest. */
export const Workstation: Story = {
  render: () => (
    <Frame>
      <Split>
        <SplitPanel defaultSize="50" minSize={DECISION_MIN} maxSize={DECISION_MAX}>
          <Decision />
        </SplitPanel>
        <SplitHandle label="Resize the decision column" />
        <SplitPanel><Evidence /></SplitPanel>
      </Split>
    </Frame>
  ),
};

/** At the narrow end of the band — 38%, the design's floor. */
export const AtTheMinimum: Story = {
  render: () => (
    <Frame>
      <Split>
        <SplitPanel defaultSize={DECISION_MIN} minSize={DECISION_MIN} maxSize={DECISION_MAX}>
          <Decision />
        </SplitPanel>
        <SplitHandle label="Resize the decision column" />
        <SplitPanel><Evidence /></SplitPanel>
      </Split>
    </Frame>
  ),
};

/** At the wide end — 74%, the design's ceiling. */
export const AtTheMaximum: Story = {
  render: () => (
    <Frame>
      <Split>
        <SplitPanel defaultSize={DECISION_MAX} minSize={DECISION_MIN} maxSize={DECISION_MAX}>
          <Decision />
        </SplitPanel>
        <SplitHandle label="Resize the decision column" />
        <SplitPanel><Evidence /></SplitPanel>
      </Split>
    </Frame>
  ),
};

/** Vertical — a stacked split, for a pane above its own log. */
export const Vertical: Story = {
  render: () => (
    <Frame>
      <Split orientation="vertical">
        <SplitPanel defaultSize="60"><Decision /></SplitPanel>
        <SplitHandle label="Resize the upper pane" />
        <SplitPanel><Evidence /></SplitPanel>
      </Split>
    </Frame>
  ),
};

/** Each half scrolls internally. The frame does not. This is the real assembly. */
export const PanesScrollNotTheFrame: Story = {
  render: () => (
    <Frame>
      <Split>
        <SplitPanel defaultSize="50" minSize={DECISION_MIN} maxSize={DECISION_MAX}>
          <ScrollArea label="Field rows">
            {Array.from({ length: 20 }, (_unused, i) => (
              <div key={i} className="px-8 py-5 font-sans text-meta leading-close">
                Instrument {i + 1}
              </div>
            ))}
          </ScrollArea>
        </SplitPanel>
        <SplitHandle label="Resize the decision column" />
        <SplitPanel>
          <ScrollArea label="Evidence"><Evidence /></ScrollArea>
        </SplitPanel>
      </Split>
    </Frame>
  ),
};
