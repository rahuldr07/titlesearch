import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { demoFields } from "@titlepipe/mocks";
import { EngineReadings } from "./EngineReadings";

const meta = {
  title: "Field/EngineReadings",
  component: EngineReadings,
  parameters: { layout: "padded" },
} satisfies Meta<typeof EngineReadings>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const fieldAt = (path: string) => {
  const found = demoFields.find((f) => f.path === path);
  if (found === undefined) throw new Error(`no demo field at ${path}`);
  return found;
};

/**
 * ATTRIBUTED BY ENGINE ID, NEVER BY SEAT. "Reader A" is a position in an array;
 * `llmwhisperer-hq` is a claim about an engine with a known failure mode — its
 * zeros-for-Os is exactly what this field is queued on.
 *
 * NEITHER IS PRE-SELECTED and no confidence is shown: highlighting one makes a
 * recommendation the server never made, and engine self-report is not evidence.
 */
export const TheyDisagree: Story = {
  args: { field: fieldAt("mortgages.1.lender"), onAdopt: noop, onPin: noop },
  render: (args) => (
    <div className="max-w-160">
      <EngineReadings {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("gemini-2.5-flash")).toBeVisible();
    await expect(canvas.getByText("llmwhisperer-hq")).toBeVisible();
    // The differing characters are marked, not left to the eye (`ux.spec` #2).
    await expect(canvas.getAllByTestId("diff-hl").length).toBeGreaterThan(0);
  },
};

/** Agreement is drawn the same way — the values simply carry no marks. */
export const TheyAgree: Story = {
  args: { field: fieldAt("owner.zip"), onAdopt: noop, onPin: noop },
  render: (args) => (
    <div className="max-w-160">
      <EngineReadings {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByTestId("diff-hl")).toHaveLength(0);
  },
};

/**
 * A BLANK IS NEVER FILLED IN FROM THE READER THAT FOUND SOMETHING. One engine
 * returned nothing and says so; the adopt control is absent on that row,
 * because there is nothing to adopt.
 */
export const OneEngineReturnedNothing: Story = {
  args: {
    field: fieldAt("judgments.1.plaintiff_attorney"),
    onAdopt: noop,
    onPin: noop,
  },
  render: (args) => (
    <div className="max-w-160">
      <EngineReadings {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("— nothing returned")).toBeVisible();
  },
};
