import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import type { FieldReading } from "@titlepipe/contract";
import { ReadingPair } from "./ReadingPair";

/**
 * The middle initial — the contract's canonical disagreement ("Is the vested
 * owner MARIA L. ESTRADA or MARIA I. ESTRADA?") — is the fixture.
 */
function reading(engine: string, value: string | null): FieldReading {
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

const meta = {
  title: "entities/ReadingPair",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: ReadingPair,
} satisfies Meta<typeof ReadingPair>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneCharacterApart: Story = {
  args: {
    a: reading("llmwhisperer", "MARIA L. ESTRADA"),
    b: reading("paddle-ocr", "MARIA I. ESTRADA"),
  },
  play: async ({ canvasElement }) => {
    // The highlight is on the DISAGREEING character and nothing else. A
    // word-level diff would mark "L." and "I." — twice the width of the
    // evidence — and this is what would fail if anyone swapped it back.
    const marked = canvasElement.querySelectorAll('[data-differs="true"]');
    expect(marked).toHaveLength(2);
    expect(Array.from(marked, (m) => m.textContent)).toEqual(["L", "I"]);
  },
};

/** Adoption — a reading enters the editor without retyping. */
export const Adoptable: Story = {
  args: {
    a: reading("llmwhisperer", "MARIA L. ESTRADA"),
    b: reading("paddle-ocr", "MARIA I. ESTRADA"),
    onAdopt: () => {},
  },
};

/** Adoption blocked states the server's reason, never hidden. */
export const AdoptionBlocked: Story = {
  args: {
    a: reading("llmwhisperer", "MARIA L. ESTRADA"),
    b: reading("paddle-ocr", "MARIA I. ESTRADA"),
    onAdopt: () => {},
    adoptBlockedBecause: "Blocked: this field is owned by QC — with R. Menon.",
  },
};

/**
 * An engine that returned nothing. Not an NA state — an engine has no
 * standing to say the instrument is silent, so it borrows the pipeline
 * sentence.
 */
export const OneEngineReturnedNothing: Story = {
  args: {
    a: reading("llmwhisperer", "MARIA L. ESTRADA"),
    b: reading("paddle-ocr", null),
  },
};

/** Wholly different readings — the highlight covers what actually differs. */
export const WhollyDifferent: Story = {
  args: {
    a: reading("llmwhisperer", "BOOK 4412 PAGE 88"),
    b: reading("paddle-ocr", "BOOK 4472 PAGE 33"),
  },
};
