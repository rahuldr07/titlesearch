import type { Meta, StoryObj } from "@storybook/react-vite";
import { EngineReadings } from "./EngineReadings";

const meta = {
  title: "Field/EngineReadings",
  component: EngineReadings,
  parameters: { layout: "padded" },
} satisfies Meta<typeof EngineReadings>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The resolution of conflict C7. The export shows one value plus an anonymous
 * `suggested` — the confidence-badge inversion in different clothes: an
 * unattributed recommendation the reviewer is invited to accept.
 *
 * NEITHER IS PRE-SELECTED. The moment one is highlighted as the default, the
 * screen makes a recommendation the backend never made (constraint 5).
 *
 * NO CONFIDENCE IS SHOWN anywhere here (conflict C10). Engine self-report is
 * not evidence.
 */
export const TheyDisagree: Story = {
  args: {
    readings: [
      { engineId: "gemini-2.5-flash", value: "SOUTHSTONE MORTGAGE LLC", page: 3 },
      { engineId: "llmwhisperer-hq", value: "S0UTHST0NE MORTGAGE LLC", page: 3 },
    ],
    onAdopt: () => {},
  },
  render: (args) => (
    <div className="max-w-160">
      <EngineReadings {...args} />
    </div>
  ),
};

/** Agreement is stated too — silence would leave the reviewer guessing. */
export const TheyAgree: Story = {
  args: {
    readings: [
      { engineId: "gemini-2.5-flash", value: "$220,224.00", page: 3 },
      { engineId: "llmwhisperer-hq", value: "$220,224.00", page: 3 },
    ],
    onAdopt: () => {},
  },
  render: (args) => (
    <div className="max-w-160">
      <EngineReadings {...args} />
    </div>
  ),
};

/**
 * "Use this" puts a reading straight into the correction editor — `ux.spec` #3,
 * "a reading can be adopted without retyping". Re-keying a value the reviewer
 * can already see is a defect source.
 */
export const SingleEngine: Story = {
  args: {
    readings: [{ engineId: "gemini-2.5-flash", value: "30296", page: 1 }],
    onAdopt: () => {},
  },
  render: (args) => (
    <div className="max-w-160">
      <EngineReadings {...args} />
    </div>
  ),
};
