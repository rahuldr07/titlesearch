import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { demoFields } from "@titlepipe/mocks";
import { FieldValue } from "./FieldValue";

const meta = {
  title: "Field/FieldValue",
  component: FieldValue,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FieldValue>;

export default meta;
type Story = StoryObj<typeof meta>;

const fieldAt = (path: string) => {
  const found = demoFields.find((f) => f.path === path);
  if (found === undefined) throw new Error(`no demo field at ${path}`);
  return found;
};

/**
 * ONE COMPONENT, EVERY ARM. This absorbed `features/review/SheetValue`: two
 * renders of the same thing existed, and only one of them refused an uncited
 * value while only the other could draw the NA states.
 */
export const EveryArm: Story = {
  args: { field: fieldAt("deed.grantor") },
  render: () => (
    <div className="flex flex-col items-start gap-8">
      <FieldValue field={fieldAt("deed.grantor")} />
      <FieldValue field={fieldAt("legal.plat_book_page")} />
      <FieldValue field={fieldAt("judgments.1.case_no")} />
      <FieldValue field={fieldAt("assessment.tax_status")} />
      <FieldValue field={fieldAt("mortgages.1.lender")} />
    </div>
  ),
};

/**
 * THE INVARIANT (`review.spec` #2): a value with no document, no page and no
 * reading behind it renders as a hard error — never a blank, never a bare
 * value. Principle 6: never emit a value you cannot cite.
 *
 * The design has NO arm for this, so the treatment is invented and flagged.
 */
export const NoProvenanceIsAnError: Story = {
  args: { field: fieldAt("judgments.1.amount") },
  render: (args) => (
    <div className="flex flex-col items-start gap-8">
      <FieldValue {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("NO PROVENANCE");
  },
};

/**
 * THE FOUR NA STATES NEVER COLLAPSE, and `pending` is a fifth thing — the
 * pipeline has not looked. Border style and fill carry the distinction, so it
 * survives greyscale; colour is secondary.
 *
 * ALL FIVE ARE ON SCREEN HERE. `NOT_FOUND` used to be missing and the play
 * function asserted `queryByText("Not Available")` — a string this component
 * structurally cannot render — so the story named for the rule could not fail.
 * `naReasonMapping.test.ts` is the static gate; this is the rendered one.
 */
export const NoValueStatesStayApart: Story = {
  args: { field: fieldAt("legal.plat_book_page") },
  render: () => (
    <div className="flex flex-col items-start gap-8">
      <FieldValue field={fieldAt("legal.plat_book_page")} />
      <FieldValue field={fieldAt("judgments.1.federal_tax_lien")} />
      <FieldValue field={fieldAt("deed.dated_date")} />
      <FieldValue field={fieldAt("judgments.1.case_no")} />
      <FieldValue field={fieldAt("assessment.tax_status")} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // What a sighted reviewer reads, per state. Pinned: two of these strings
    // were mutated in an audit and 497 tests still passed.
    for (const chip of [
      "n/a — not used in this jurisdiction",
      "Not found — searched, none of record",
      "Document silent — not stated on any page",
      "Present — unreadable on page 30",
      "not yet extracted",
    ]) {
      await expect(canvas.getAllByText(chip)[0]).toBeVisible();
    }

    // What a screen-reader user hears. One per chip — the PageChip's own
    // sr-only name lives inside a button and is not a state.
    const spoken = Array.from(canvasElement.querySelectorAll("span.sr-only"))
      .filter((node) => node.closest("button") === null)
      .map((node) => node.textContent ?? "");
    await expect(spoken).toHaveLength(5);
    await expect(new Set(spoken).size).toBe(5);
    await expect([...spoken].sort()).toEqual(
      [
        "Document silent — not stated on any page",
        "Not applicable — this field is not used in this jurisdiction",
        "Not found — searched, none of record",
        "Not yet extracted — the pipeline has not reached this field",
        "Present but unreadable on page 30",
      ].sort(),
    );

    // PENDING IS NOT AN ANSWER. It must never borrow an NA state's words —
    // "the pipeline has not looked" and "the document does not say it" are
    // opposite claims about the same blank cell.
    const pending = Array.from(canvasElement.querySelectorAll("span.sr-only")).find((node) =>
      (node.textContent ?? "").startsWith("Not yet extracted"),
    )?.parentElement;
    const pendingText = (pending?.textContent ?? "").toLowerCase();
    await expect(pendingText).not.toBe("");
    for (const word of ["n/a", "not available", "not found", "silent", "unreadable"]) {
      await expect(pendingText).not.toContain(word);
    }
  },
};
