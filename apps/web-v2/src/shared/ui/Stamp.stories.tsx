import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stamp } from "./Stamp";

const meta = {
  title: "Primitives/Stamp",
  component: Stamp,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Stamp>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Label and tone are SERVER-SUPPLIED. The export computed this from a
 * five-branch `if/else` in the browser (conflict C2) — a client-side state
 * machine, forbidden by hard constraint 9. This component asks no questions
 * about what it is given.
 */
export const Tones: Story = {
  args: { children: "Ready" },
  render: () => (
    <div className="flex flex-wrap items-center gap-10">
      <Stamp tone="action">Decisions open</Stamp>
      <Stamp tone="attend">Sign-off open</Stamp>
      <Stamp tone="halt">Package incomplete</Stamp>
      <Stamp tone="settled">Ready</Stamp>
      <Stamp tone="neutral">Archived</Stamp>
    </div>
  ),
};

export const Sizes: Story = {
  args: { children: "Finalized" },
  render: () => (
    <div className="flex flex-wrap items-center gap-10">
      <Stamp size="sm" tone="action">
        Decisions open
      </Stamp>
      <Stamp size="md" tone="attend">
        Session ended
      </Stamp>
      <Stamp size="lg" tone="action">
        Reissued · v2
      </Stamp>
      <Stamp size="xl" tone="settled">
        Finalized
      </Stamp>
    </div>
  ),
};
