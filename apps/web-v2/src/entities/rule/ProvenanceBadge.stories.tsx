import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProvenanceBadge, OriginLabel } from "./ProvenanceBadge";

const meta = {
  title: "Rule/ProvenanceBadge",
  component: ProvenanceBadge,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ProvenanceBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Two of these are NOT chosen. The design states it and it is worth keeping:
 * "OPEN and CONFLICT are assigned by the machine, not chosen" — you cannot
 * author a rule into a state it can never leave.
 *
 * There is no `unknown` variant, deliberately: a line with no traceable source
 * is a config DEFECT, not a state, and giving it a badge would make it look
 * like one.
 */
export const RuleProvenance: Story = {
  args: { provenance: "RULED" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <ProvenanceBadge provenance="RULED" />
      <ProvenanceBadge provenance="DERIVED" />
      <ProvenanceBadge provenance="OPEN" />
      <ProvenanceBadge provenance="CONFLICT" />
    </div>
  ),
};

/** Config lines: overrides are stored as deltas, so every line says which it is. */
export const ConfigLineOrigin: Story = {
  args: { provenance: "RULED" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <OriginLabel origin="baseline" />
      <OriginLabel origin="narrowed" />
      <OriginLabel origin="replaced" />
      <OriginLabel origin="added" />
    </div>
  ),
};
