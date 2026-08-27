import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import type { Field, FieldReading } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { DecisionCard } from "./DecisionCard";

/**
 * THE ONE ACCENT SPEND (rule 1). Every story here draws exactly one accent
 * rail and hands in ONE primary action, because the card is the screen's spend
 * and a second primary inside it would be the second.
 */
const FIELD: Field = {
  id: "f-1",
  order_id: "TP-2026-04412",
  path: "vesting.grantee",
  value: "MARIA L. ESTRADA",
  na_reason: null,
  state: "needs_review",
  source_doc_id: "DOC-8841",
  source_page: 12,
  source_snippet: "…unto MARIA L. ESTRADA, a married woman…",
  source_line_coords: null,
  engine_id: "llmwhisperer",
  engine_confidence_raw: 0.62,
  rule_refs: ["R13"],
  approved_by: null,
  approved_at: null,
  asking: "Is the vested owner MARIA L. ESTRADA or MARIA I. ESTRADA?",
  why: "Two independent readers disagreed on the middle initial.",
};

function reading(engine: string, value: string): FieldReading {
  return {
    id: `r-${engine}`,
    field_id: "f-1",
    engine_id: engine,
    value,
    page: 12,
    snippet: "…unto MARIA L. ESTRADA, a married woman…",
    confidence_raw: 0.91,
    cost_usd: 0.004,
    latency_ms: 1830,
    line_coords: null,
  };
}

const ACTIONS = (
  <>
    <Button variant="primary">Confirm</Button>
    <Button variant="secondary">Edit</Button>
    <Button variant="secondary">Escalate</Button>
  </>
);

const meta = {
  title: "entities/DecisionCard",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: DecisionCard,
  args: { actions: ACTIONS },
} satisfies Meta<typeof DecisionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored question, verbatim. */
export const Authored: Story = { args: { field: FIELD } };

/**
 * The full decision: question, value, both readings, the amber consequence.
 * `engine_confidence_raw` is 0.62 on this fixture and changes NOTHING about
 * what is drawn — the state pill still reads what the server sent.
 */
export const WithReadingsAndConsequence: Story = {
  args: {
    field: FIELD,
    readings: {
      a: reading("llmwhisperer", "MARIA L. ESTRADA"),
      b: reading("paddle-ocr", "MARIA I. ESTRADA"),
    },
    consequence: "A wrong vested owner voids the policy and is not caught downstream.",
    onAdoptReading: () => {},
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector("[data-consequence]")).not.toBeNull();
    // The state is the SERVER'S, not a function of the 0.62 confidence.
    const pill = canvasElement.querySelector("[data-field-state]");
    expect(pill?.getAttribute("data-field-state")).toBe("needs_review");
  },
};

/**
 * ROUTED, BUT NO QUESTION AUTHORED YET. `asking` is null and the card says so
 * plainly rather than composing one — see `DecisionQuestion`. A plausible
 * invented question is worse than a missing one.
 */
export const QuestionNotAuthored: Story = {
  args: { field: { ...FIELD, asking: null, why: null } },
  play: async ({ canvasElement }) => {
    const q = canvasElement.querySelector("[data-decision-question]");
    expect(q?.getAttribute("data-decision-question")).toBe("unauthored");
  },
};

/**
 * NEVER ROUTED TO REVIEW. `asking` is absent — a third statement, not a second
 * spelling of null — and no question is drawn at all.
 */
export const NeverRouted: Story = {
  args: {
    /* Deleted, not destructured-around: no unused bindings for §6 to reject. */
    field: ((): typeof FIELD => {
      const rest = { ...FIELD };
      delete rest.asking;
      delete rest.why;
      return rest;
    })(),
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector("[data-decision-question]")).toBeNull();
  },
};

/** An absence under decision: the value slot renders a typed NA, never a blank. */
export const DecidingAnAbsence: Story = {
  args: {
    field: {
      ...FIELD,
      value: null,
      na_reason: "PRESENT_UNREADABLE",
      asking: "The instrument number is on the page but illegible. Record it as unreadable?",
      why: "Microfilm density loss across the clerk stamp band.",
    },
    consequence: "An unreadable instrument number blocks the chain from terminating.",
  },
};

/** THE DEFECT, UNDER DECISION. A value the server sent with no source at all. */
export const UncitedValue: Story = {
  args: {
    field: { ...FIELD, source_doc_id: null, source_page: null, source_snippet: null },
    consequence: "This value has no source on record and cannot be delivered.",
  },
  play: async ({ canvasElement }) => {
    const rendered = canvasElement.querySelector("[data-field-render]");
    expect(rendered?.getAttribute("data-field-render")).toBe("uncited");
  },
};
