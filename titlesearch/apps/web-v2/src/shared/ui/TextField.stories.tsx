import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextField, TextArea } from "./TextField";
import { Eyebrow } from "./Eyebrow";

const meta = {
  title: "Primitives/TextField",
  component: TextField,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-3">
    <Eyebrow variant="field">{label}</Eyebrow>
    {children}
  </label>
);

export const Sizes: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-8 max-w-140">
      <Field label="Compact"><TextField size="sm" defaultValue="Clayton" /></Field>
      <Field label="Standard"><TextField size="md" defaultValue="Clayton" /></Field>
    </div>
  ),
};

/**
 * Stroke weight is meaning: 1px resting, 1.5px load-bearing. Tone is set by the
 * CALLER from server state — never from the browser's `:invalid`, which would
 * make the client the authority on validity (§9.14).
 */
export const Emphasis: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-8 max-w-140">
      <Field label="Resting"><TextField placeholder="1px, neutral" /></Field>
      <Field label="Required, unanswered">
        <TextField tone="halt" emphasis placeholder="1.5px, halt" />
      </Field>
      <Field label="Answered">
        <TextField tone="settled" emphasis defaultValue="Words line reads $220,224" />
      </Field>
      <Field label="Citation">
        <TextField tone="action" emphasis defaultValue="security deed p 3" />
      </Field>
    </div>
  ),
};

export const Disabled: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-8 max-w-140">
      <Field label="Disabled"><TextField disabled defaultValue="Frozen on the order" /></Field>
    </div>
  ),
};

export const Area: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-8 max-w-160">
      <Field label="Ruling">
        <TextArea placeholder="A hit is ours when name + county match during our grantor's ownership." />
      </Field>
      <Field label="Reason — required">
        <TextArea tone="halt" emphasis rows={2} />
      </Field>
    </div>
  ),
};
