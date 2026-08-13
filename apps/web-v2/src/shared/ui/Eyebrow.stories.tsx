import type { Meta, StoryObj } from "@storybook/react-vite";
import { Eyebrow } from "./Eyebrow";

const meta = {
  title: "Primitives/Eyebrow",
  component: Eyebrow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Eyebrow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Roles: Story = {
  args: { children: "Ordered" },
  render: () => (
    <div className="flex flex-col gap-8">
      <Eyebrow variant="screen">Abstractor review</Eyebrow>
      <Eyebrow variant="group">Decision queue</Eyebrow>
      <Eyebrow variant="section">What I can do</Eyebrow>
      <Eyebrow variant="field">Client</Eyebrow>
      <Eyebrow variant="caption">Versions · immutable</Eyebrow>
      <Eyebrow variant="stat">Pages read in full</Eyebrow>
    </div>
  ),
};

/**
 * Violet is never decorative on an eyebrow — it marks the step you are on.
 * Of 133 bare eyebrows in the design, 70 are muted and 26 are action.
 */
export const Tones: Story = {
  args: { children: "Citation" },
  render: () => (
    <div className="flex flex-col gap-8">
      <Eyebrow tone="muted">Ordered</Eyebrow>
      <Eyebrow tone="strong">Sign-off lines</Eyebrow>
      <Eyebrow tone="action">Citation</Eyebrow>
      <Eyebrow tone="settled">We found</Eyebrow>
      <Eyebrow tone="attend">Provisional</Eyebrow>
      <Eyebrow tone="halt">Missing</Eyebrow>
    </div>
  ),
};

/** Every `<label>` in the design is the `field` variant exactly. */
export const AsLabel: Story = {
  args: { children: "Rule citation" },
  render: () => (
    <div className="flex flex-col gap-3 max-w-110">
      <Eyebrow as="label" htmlFor="demo-cite">
        Rule citation
      </Eyebrow>
      <input
        id="demo-cite"
        className="w-full border border-line-strong rounded-6 px-5 py-4 text-base"
      />
    </div>
  ),
};
