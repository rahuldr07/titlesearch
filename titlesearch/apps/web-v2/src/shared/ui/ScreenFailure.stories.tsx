import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScreenFailure } from "./ScreenFailure";

const meta = {
  title: "Primitives/ScreenFailure",
  component: ScreenFailure,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ScreenFailure>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Copy is the design's own, verbatim — harvested orphan rule O6 independently
 * rediscovered and better stated: a screen that fails half-way and renders an
 * empty region looks identical to one that succeeded and found nothing, and in
 * this product those mean opposite things.
 */
export const Failed: Story = {
  args: {},
  render: () => (
    <div className="max-w-160">
      <ScreenFailure />
    </div>
  ),
};

export const WithReference: Story = {
  args: { reference: "scr_7f3a91" },
  render: () => (
    <div className="max-w-160">
      <ScreenFailure reference="scr_7f3a91" />
    </div>
  ),
};
