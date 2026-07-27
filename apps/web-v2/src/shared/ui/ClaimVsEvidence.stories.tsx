import type { Meta, StoryObj } from "@storybook/react-vite";
import { ClaimVsEvidence } from "./ClaimVsEvidence";

const meta = {
  title: "Primitives/ClaimVsEvidence",
  component: ClaimVsEvidence,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ClaimVsEvidence>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MachineContradictsHuman: Story = {
  args: {
    claim: "All recorded instruments in the chain are present.",
    evidence: "Two instruments referenced in the vesting deed were not segmented.",
  },
  render: (args) => (
    <div className="max-w-160">
      <ClaimVsEvidence {...args} />
    </div>
  ),
};

/** Complaint capture — `delivery-complaints.spec` #4, with the labels changed. */
export const ClientComplaint: Story = {
  args: {
    claimLabel: "Client says",
    claim: "The HUD shows 215,500.",
    evidenceLabel: "We reported",
    evidence: "215,000.",
  },
  render: (args) => (
    <div className="max-w-160">
      <ClaimVsEvidence {...args} />
    </div>
  ),
};

/**
 * THE IMPORTANT ONE. A check whose precondition is a fixture rather than a real
 * signal refuses to present itself as evidence — principle 6 applied to a CHECK
 * rather than a value.
 *
 * The design does this to its own completeness gate, in a comment headed
 * PROVENANCE AUDIT, and then renders the caveat to the user rather than hiding
 * it. That instinct is the most trustworthy thing in the export.
 */
export const Provisional: Story = {
  args: {
    claim: "Root of title has been reached.",
    evidence: "The chain terminates at a 1998 warranty deed.",
    provisionalReason:
      "The precondition behind this gate is a fixture on the build, not a segmentation this package produced. It reads the same on every order, so this card cannot yet be trusted as evidence about THIS one.",
  },
  render: (args) => (
    <div className="max-w-160">
      <ClaimVsEvidence {...args} />
    </div>
  ),
};
