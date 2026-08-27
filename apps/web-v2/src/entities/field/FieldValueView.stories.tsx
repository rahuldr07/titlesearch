import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { NaReason } from "@titlepipe/contract";
import { FieldValueView } from "./FieldValueView";
import type { Citation } from "../../shared/provenance";

/**
 * THE STATES GALLERY, AND THE ASSERTION UNDER IT.
 *
 * The design carries a card reading "They must never collapse into one grey
 * dash" (`enums.ts:24-27`). `AllFiveRenders` is that card, made real: five
 * absences on one canvas so a reviewer can SEE they are five things.
 *
 * `noValueStates.test.ts` proves the descriptor table is distinct without a DOM.
 * The play function below proves the RENDERED OUTPUT is — different text and
 * different `data-field-render` — which is the half a table cannot promise.
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

/**
 * THE DEFECT. A value with no source — `entities.ts:85-89`, "the exact failure
 * shape the architecture exists to catch". Drawn as the defect it is.
 */
export const Uncited: Story = {
  args: { value: { kind: "uncited", value: "MARIA L. ESTRADA" } },
};

export const NotPresent: Story = {
  args: { value: { kind: "na", reason: "NOT_PRESENT", citation: null } },
};

export const NotFound: Story = {
  args: { value: { kind: "na", reason: "NOT_FOUND", citation: null } },
};

export const NotStated: Story = {
  args: { value: { kind: "na", reason: "NOT_STATED", citation: null } },
};

/** The only member carrying a page reference (`enums.ts:41-43`). */
export const PresentUnreadable: Story = {
  args: { value: { kind: "na", reason: "PRESENT_UNREADABLE", citation: CITATION } },
};

/** A statement about the PIPELINE, not the document. */
export const NotExtracted: Story = { args: { value: { kind: "not-extracted" } } };

/**
 * ALL FIVE, SIDE BY SIDE, WITH THE COLLAPSE ASSERTED AGAINST.
 *
 * `render` rather than `args` because the point is the COMPARISON: five
 * separate stories can each be correct while two of them look identical, and
 * only one canvas holding all five can fail on that.
 */
export const AllFiveRenders: Story = {
  args: { value: { kind: "not-extracted" } },
  render: () => (
    <div className="flex flex-col gap-8">
      {NaReason.options.map((reason) => (
        <FieldValueView key={reason} value={{ kind: "na", reason, citation: null }} />
      ))}
      <FieldValueView value={{ kind: "not-extracted" }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const nodes = canvasElement.querySelectorAll("[data-field-render]");
    expect(nodes).toHaveLength(5);

    // DIFFERENT DATA ATTRIBUTES — the machine-readable distinction, and what
    // `e2e/invariants` can assert against on a real screen.
    const kinds = Array.from(nodes, (n) => n.getAttribute("data-field-render"));
    expect(new Set(kinds).size).toBe(5);

    // DIFFERENT TEXT CONTENT — the human-readable one. A grey dash in place of
    // any of these collapses the set and fails right here.
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
        <FieldValueView key={reason} value={{ kind: "na", reason, citation: null }} />
      ))}
      <FieldValueView value={{ kind: "not-extracted" }} />
    </div>
  ),
};
