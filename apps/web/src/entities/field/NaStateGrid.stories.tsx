import { onPanel } from "../panelGround";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { NaReason } from "@titlepipe/contract";
import { NaStateGrid } from "./NaStateGrid";

/**
 * The 4-state picker. All four are offered, INCLUDING NOT_PRESENT — see the
 * component's own note: "never surfaced for review" is a statement about the
 * QUEUE, not about what a reviewer looking at the row may rule.
 */
const meta = {
  title: "entities/NaStateGrid",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: NaStateGrid,
} satisfies Meta<typeof NaStateGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing chosen. The reviewer has not ruled yet, and that is not an NA state. */
export const Unchosen: Story = { args: { value: null, onChange: () => {} } };

export const NotFoundChosen: Story = { args: { value: "NOT_FOUND", onChange: () => {} } };

/** Blocked states its reason, and the server authored this sentence. */
export const BlockedWithReason: Story = {
  args: {
    value: null,
    onChange: () => {},
    disabledBecause: "Blocked: this field is not absence-only — enter a value or escalate.",
  },
};

/** The picker actually picking, so the a11y gate exercises a real selection. */
export const Interactive: Story = {
  args: { value: null, onChange: () => {} },
  render: function Interactive() {
    const [reason, setReason] = useState<NaReason | null>(null);
    return <NaStateGrid value={reason} onChange={setReason} />;
  },
};
