import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-6">{children}</div>
);

export const Solid: Story = {
  args: { children: "Take next order" },
  render: () => (
    <Row>
      <Button tone="action">Take next order</Button>
      <Button tone="settled">Record root of title</Button>
      <Button tone="attend">Change product &amp; record</Button>
      <Button tone="halt">Confirm — retire</Button>
    </Row>
  ),
};

export const Outlined: Story = {
  args: { children: "Escalate" },
  render: () => (
    <Row>
      <Button fill="outlined" tone="action">Save as PENDING</Button>
      <Button fill="outlined" tone="settled">✓ Accept as stated</Button>
      <Button fill="outlined" tone="attend">↗ Escalate</Button>
      <Button fill="outlined" tone="halt">Acknowledge conflict</Button>
      <Button fill="outlined" tone="neutral">Cancel</Button>
    </Row>
  ),
};

export const Tinted: Story = {
  args: { children: "Go to a page read in full" },
  render: () => (
    <Row>
      <Button fill="tinted" tone="action">Go to a page read in full</Button>
      <Button fill="tinted" tone="settled">Confirmed</Button>
      <Button fill="tinted" tone="attend">Provisional</Button>
      <Button fill="tinted" tone="halt">Package incomplete</Button>
    </Row>
  ),
};

export const Ghost: Story = {
  args: { children: "Profile" },
  render: () => (
    <Row>
      <Button fill="ghost" tone="neutral">Profile</Button>
      <Button fill="ghost" tone="halt">Sign out</Button>
    </Row>
  ),
};

export const Sizes: Story = {
  args: { children: "Continue" },
  render: () => (
    <Row>
      <Button size="sm">Edit</Button>
      <Button size="md">Add a client</Button>
      <Button size="lg">Save line</Button>
    </Row>
  ),
};

export const FullWidth: Story = {
  args: { children: "Sign in" },
  render: () => (
    <div className="max-w-110">
      <Button size="xl">Sign in</Button>
    </div>
  ),
};

/**
 * Disabled is a SURFACE SWAP, never opacity — the design's own rule. Opacity
 * means something different in this system (permission-denied / retired), so
 * dimming a validation-blocked control would read as "you may not" instead of
 * "not yet".
 */
export const Disabled: Story = {
  args: { children: "Start pipeline", disabled: true },
  render: () => (
    <Row>
      <Button disabled>Start pipeline</Button>
      <Button fill="outlined" tone="neutral" disabled>Cancel</Button>
      <Button fill="tinted" tone="action" disabled>View on p7</Button>
      <Button fill="ghost" tone="neutral" disabled>Profile</Button>
    </Row>
  ),
};

export const Focused: Story = {
  args: { children: "Focus me", autoFocus: true },
  render: () => (
    <Row>
      <Button autoFocus>Tab to me — 2px violet ring, 2px offset</Button>
    </Row>
  ),
};
