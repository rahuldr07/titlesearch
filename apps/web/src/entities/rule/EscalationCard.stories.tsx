import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import type { Escalation } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { EscalationCard } from "./EscalationCard";

const BASE: Escalation = {
  id: "esc-19",
  field_path_cluster: "vesting.grantee",
  order_ids: ["TP-2026-04412", "TP-2026-04418"],
  question:
    "When a deed names a grantee with a middle initial the deed itself never spells out, which reading governs?",
  resolution: null,
  rule_id: null,
  resolved_by: null,
  // The evidence members — null is the ordinary state for a cluster raised
  // without attached evidence.
  raised_by: null,
  age: null,
  context: null,
  excerpt: null,
  identity: null,
  qc_owner: null,
};

const meta = {
  title: "entities/EscalationCard",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: EscalationCard,
} satisfies Meta<typeof EscalationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open. No category, no priority, no assignee. */
export const Open: Story = { args: { escalation: BASE } };

/**
 * The refusal this component exists for: a ruling was recorded and no rule
 * was cited, so it renders as still open — a card that drew this as settled
 * would have performed, on screen, the resolution the server refused.
 */
export const RuledButNoRule: Story = {
  args: {
    escalation: { ...BASE, resolution: "Take the reading that matches the vesting deed." },
  },
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector("[data-escalation]");
    expect(card?.getAttribute("data-resolved-by-rule")).toBe("false");
    expect(canvasElement.querySelector('[data-refusal="no-rule"]')).not.toBeNull();
  },
};

/** Resolved the only way it can be: a rule. */
export const ResolvedByRule: Story = {
  args: {
    escalation: {
      ...BASE,
      resolution: "Take the reading that matches the vesting deed.",
      rule_id: "rule-88",
      resolved_by: "R. Menon",
    },
  },
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector("[data-escalation]");
    expect(card?.getAttribute("data-resolved-by-rule")).toBe("true");
    expect(canvasElement.querySelector('[data-refusal="no-rule"]')).toBeNull();
  },
};

/** The two resolution paths, and deliberately no third. */
export const WithBothResolutionPaths: Story = {
  args: {
    escalation: BASE,
    actions: (
      <>
        <Button variant="secondary">Cite an existing rule</Button>
        <Button variant="secondary">Draft a rule</Button>
      </>
    ),
  },
};
