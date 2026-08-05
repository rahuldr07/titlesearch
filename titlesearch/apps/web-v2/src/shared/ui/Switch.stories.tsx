import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "./Switch";

const meta = {
  title: "Primitives/Switch",
  component: Switch,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-6 border-t border-line-subtle py-5">
    <span className="flex-1 text-base">{label}</span>
    {children}
  </div>
);

/**
 * 42x24 track, 20px knob inset 2px, 18px travel — every dimension lands on the
 * 2px grid. State comes from Base UI's `data-checked` attribute rather than a
 * React prop, so the DOM carries it for tests and assistive tech.
 */
export const States: Story = {
  args: { "aria-label": "Reduced motion" },
  render: () => (
    <div className="max-w-140">
      <Row label="Reduced motion">
        <Switch aria-label="Reduced motion" defaultChecked />
      </Row>
      <Row label="Keyboard shortcuts">
        <Switch aria-label="Keyboard shortcuts" />
      </Row>
      <Row label="Locked by policy">
        <Switch aria-label="Locked by policy" disabled defaultChecked />
      </Row>
      <Row label="Unavailable">
        <Switch aria-label="Unavailable" disabled />
      </Row>
    </div>
  ),
};
