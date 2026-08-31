import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { NaReason } from "@titlepipe/contract";
import { FieldValueView } from "./FieldValueView";
import type { Citation } from "../../shared/provenance";
import { naFieldValue } from "../../shared/provenance";

/**
 * The states gallery: five absences on one canvas so a reviewer can see they
 * are five things. noValueStates.test.ts proves the descriptor table is
 * distinct without a DOM; the play here proves the rendered output is —
 * different text and different `data-field-render`.
 */
const CITATION: Citation = {
  docId: "DOC-8841",
  page: 12,
  snippet: "MARIA L. ESTRADA, a married woman",
};

const meta = {
  title: "entities/FieldValueView",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: FieldValueView,
} satisfies Meta<typeof FieldValueView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary case: a value that carries its source. */
export const Cited: Story = {
  args: { value: { kind: "cited", cited: { value: "MARIA L. ESTRADA", citation: CITATION } } },
};

export const CitedClickable: Story = {
  args: {
    value: { kind: "cited", cited: { value: "MARIA L. ESTRADA", citation: CITATION } },
    onOpenCitation: () => {},
  },
};

/** The defect: a value with no source, drawn as the defect it is. */
export const Uncited: Story = {
  args: { value: { kind: "uncited", value: "MARIA L. ESTRADA" } },
};

export const NotPresent: Story = {
  args: { value: { kind: "na-not-present" } },
};

export const NotFound: Story = {
  args: { value: { kind: "na-not-found" } },
};

export const NotStated: Story = {
  args: { value: { kind: "na-not-stated" } },
};

/** The only member carrying a page reference. */
export const PresentUnreadable: Story = {
  args: { value: { kind: "na-present-unreadable", citation: CITATION } },
};

/** A statement about the pipeline, not the document. */
export const NotExtracted: Story = { args: { value: { kind: "not-extracted" } } };

/**
 * All five, side by side, with the collapse asserted against. `render`
 * rather than `args` because the point is the comparison: five separate
 * stories can each be correct while two of them look identical.
 */
export const AllFiveRenders: Story = {
  args: { value: { kind: "not-extracted" } },
  render: () => (
    <div className="flex flex-col gap-8">
      {NaReason.options.map((reason) => (
        <FieldValueView key={reason} value={naFieldValue(reason, null)} />
      ))}
      <FieldValueView value={{ kind: "not-extracted" }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const nodes = canvasElement.querySelectorAll("[data-field-render]");
    expect(nodes).toHaveLength(5);

    // Different data attributes — the machine-readable distinction, and what
    // e2e/invariants can assert against on a real screen.
    const kinds = Array.from(nodes, (n) => n.getAttribute("data-field-render"));
    expect(new Set(kinds).size).toBe(5);

    // Different text content — the human-readable one. A grey dash in place
    // of any of these collapses the set and fails right here.
    const sentences = Array.from(nodes, (n) => n.textContent?.trim() ?? "");
    expect(new Set(sentences).size).toBe(5);
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/^[-\u2014\u2013\s\u2022\u25c6]*$/);
    }
  },
};

/** The defect and the four absences together — six renders, six appearances. */
export const AbsencesAndTheDefect: Story = {
  args: { value: { kind: "uncited", value: "MARIA L. ESTRADA" } },
  render: () => (
    <div className="flex flex-col gap-8">
      <FieldValueView value={{ kind: "cited", cited: { value: "MARIA L. ESTRADA", citation: CITATION } }} />
      <FieldValueView value={{ kind: "uncited", value: "MARIA L. ESTRADA" }} />
      {NaReason.options.map((reason) => (
        <FieldValueView key={reason} value={naFieldValue(reason, null)} />
      ))}
      <FieldValueView value={{ kind: "not-extracted" }} />
    </div>
  ),
};
