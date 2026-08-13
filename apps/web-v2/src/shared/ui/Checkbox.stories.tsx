import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./Checkbox";

const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

const Row = ({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) => (
  <label htmlFor={id} className="flex items-center gap-5 text-base">
    {children}
    <span>{label}</span>
  </label>
);

/**
 * Geometry is borrowed from the baseline grid's tri-state mark button — the one
 * square control the design actually draws — so every square control in the app
 * is the same size rather than each inventing its own.
 */
export const States: Story = {
  args: { "aria-label": "Offer as a golden case" },
  render: () => (
    <div className="flex flex-col gap-6">
      <Row id="cb-1" label="Offer as a golden case">
        <Checkbox id="cb-1" />
      </Row>
      <Row id="cb-2" label="Acknowledge the conflict">
        <Checkbox id="cb-2" defaultChecked />
      </Row>
      <Row id="cb-3" label="Narrowed — some lines waived">
        <Checkbox id="cb-3" indeterminate />
      </Row>
      <Row id="cb-4" label="Locked by policy">
        <Checkbox id="cb-4" disabled defaultChecked />
      </Row>
      <Row id="cb-5" label="Unavailable">
        <Checkbox id="cb-5" disabled />
      </Row>
    </div>
  ),
};
