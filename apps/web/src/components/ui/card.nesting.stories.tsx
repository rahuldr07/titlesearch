import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Card, InnerPanel } from "./card";
import { onCanvas } from "./kitGround";
import { RenderBoundary } from "./renderBoundary";

/**
 * Nested cards throw; these stories prove the throw is caught and displayed
 * rather than crashing the frame.
 */
const meta = {
  title: "ui/Card/nesting",
  component: Card,
  decorators: [onCanvas],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * RenderBoundary and not try/catch — see that file for why the obvious
 * version silently fails.
 */
export const NestedCardsThrow: Story = {
  args: { children: "" },
  render: () => (
    <RenderBoundary>
      <Card>
        <Card>Illegal</Card>
      </Card>
    </RenderBoundary>
  ),
  play: ({ canvasElement }) => {
    expect(canvasElement.textContent).toContain("Nested cards are forbidden");
  },
};

/**
 * The reason the guard uses two contexts: a single cleared boolean would let
 * card > panel > card render two 14px surfaces one inside the other — the
 * arrangement that actually happens, unlike direct card-in-card.
 */
export const NestedThroughAPanelThrows: Story = {
  args: { children: "" },
  render: () => (
    <RenderBoundary>
      <Card>
        <InnerPanel>
          <Card>Illegal, one level down</Card>
        </InnerPanel>
      </Card>
    </RenderBoundary>
  ),
  play: ({ canvasElement }) => {
    expect(canvasElement.textContent).toContain("Nested cards are forbidden");
  },
};

/** Panels nest by their own rule; only cards are barred. */
export const PanelInsidePanelIsLegal: Story = {
  args: { children: "" },
  render: () => (
    <Card padding="comfortable">
      <InnerPanel>
        <InnerPanel>Legal: card &gt; panel &gt; panel</InnerPanel>
      </InnerPanel>
    </Card>
  ),
};
