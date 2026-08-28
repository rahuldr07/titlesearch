import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Card, InnerPanel } from "./card";
import { onCanvas } from "./kitGround";
import { RenderBoundary } from "./renderBoundary";

/**
 * A card lives on the CANVAS, not on a panel — so these stories use `onCanvas`,
 * which is the surface that makes its shadow and its border mean anything.
 *
 * The last story is the important one: nested cards throw, and the throw is
 * caught and displayed rather than crashing the frame.
 */
const meta = {
  title: "ui/Card/nesting",
  component: Card,
  decorators: [onCanvas],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * NESTED CARDS THROW. The registry lets cards nest freely; RECIPES forbids it,
 * and this is the enforcement rather than a comment asking nicely.
 *
 * `RenderBoundary` and not try/catch — see that file for why the obvious
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
 * THE CASE THAT USED TO PASS, and the reason the guard now uses two contexts.
 *
 * `InnerPanel` once cleared a single boolean, so a card inside a PANEL inside a
 * card rendered two 14px surfaces one within the other — measured, confirmed,
 * REVIEW-03 B4. That is the arrangement that actually happens (a card, a
 * section in it, a card in that section); direct card-in-card is the one nobody
 * writes by accident. RECIPES §Card forbids nesting full stop, not "unless
 * separated by a panel".
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
