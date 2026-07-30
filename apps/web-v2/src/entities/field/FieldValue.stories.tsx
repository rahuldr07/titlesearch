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
 */
export const NoValueStatesStayApart: Story = {
  args: { field: fieldAt("legal.plat_book_page") },
  render: () => (
    <div className="flex flex-col items-start gap-8">
      <FieldValue field={fieldAt("legal.plat_book_page")} />
      <FieldValue field={fieldAt("judgments.1.case_no")} />
      <FieldValue field={fieldAt("deed.dated_date")} />
      <FieldValue field={fieldAt("assessment.tax_status")} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("not yet extracted")).toBeVisible();
    await expect(canvas.queryByText("Not Available")).not.toBeInTheDocument();
  },
};
