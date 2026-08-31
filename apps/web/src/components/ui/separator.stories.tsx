import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "./separator";
import { onPanel } from "./kitGround";

/**
 * A hairline divides an interior. Both orientations, and the one thing worth
 * seeing: it is quieter than the border of the thing containing it.
 */
const meta = {
  title: "ui/Separator",
  decorators: [onPanel],
  component: Separator,
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Between rows. */
export const Horizontal: Story = {
  render: () => (
    <div className="w-160 font-sans text-meta leading-close text-ink-primary">
      <p className="py-6">Grantor: Ana R. Delgado</p>
      <Separator />
      <p className="py-6">Grantee: Delgado Family Trust</p>
    </div>
  ),
};

/** Between inline facts in one row. */
export const Vertical: Story = {
  render: () => (
    <div className="flex h-12 items-center gap-6 font-sans text-meta leading-close text-ink-secondary">
      <span>Harris County</span>
      <Separator orientation="vertical" />
      <span className="font-mono">2024-0448192</span>
      <Separator orientation="vertical" />
      <span>Warranty deed</span>
    </div>
  ),
};

/** Inside a card, against the card's own stronger edge. The point of `subtle`. */
export const AgainstACardEdge: Story = {
  render: () => (
    <div className="w-160 rounded-lg border border-line-strong p-8">
      <p className="pb-6 font-sans text-meta leading-close text-ink-primary">
        Interior division
      </p>
      <Separator />
      <p className="pt-6 font-sans text-meta leading-close text-ink-primary">
        is quieter than the edge
      </p>
    </div>
  ),
};
