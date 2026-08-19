import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { demoFields } from "@titlepipe/mocks";
import { DecisionRow } from "./DecisionRow";
import { Card } from "../../shared/ui/Card";

const meta = {
  title: "Field/DecisionRow",
  component: DecisionRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DecisionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const fieldAt = (path: string) => {
  const found = demoFields.find((f) => f.path === path);
  if (found === undefined) throw new Error(`no demo field at ${path}`);
  return found;
};

/**
 * THE WHOLE ROW IS THE BUTTON, not an `<li>` holding one. A row that IS a
 * control is reached in one Tab and its click target is the rectangle a mouse
 * user already aims at; a row wrapping a smaller control leaves a gutter that
 * looks clickable and is not.
 *
 * This story exists to pin that: the assertion below fails the moment somebody
 * nests the control again, which no visual check would catch.
 */
export const TheRowIsTheButton: Story = {
  args: { field: fieldAt("mortgages.1.lender"), onActivate: noop },
  render: (args) => (
    <div className="max-w-200">
      <Card>
        <DecisionRow {...args} />
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByTestId("row-mortgages.1.lender");
    await expect(row.tagName).toBe("BUTTON");
    // Nothing inside may be a second control: a button in a button is invalid
    // HTML that screen readers announce unpredictably.
    await expect(row.querySelector("button")).toBeNull();
  },
};

/**
 * "NOT AVAILABLE" IS WHAT SHIPS; THE CHIP IS WHAT SEPARATES THE FOUR REASONS
 * (`review.spec` #1) — and `pending` is a fifth thing that must never read as
 * an NA, because the pipeline has not looked yet.
 */
export const NoValueReasonsStayApart: Story = {
  args: { field: fieldAt("legal.plat_book_page"), onActivate: noop },
  render: () => (
    <div className="max-w-200">
      <Card>
        <DecisionRow field={fieldAt("legal.plat_book_page")} onActivate={noop} />
        <DecisionRow field={fieldAt("judgments.1.case_no")} onActivate={noop} />
        <DecisionRow field={fieldAt("assessment.tax_status")} onActivate={noop} />
        <DecisionRow field={fieldAt("judgments.1.amount")} onActivate={noop} />
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("N/A — EXPECTED")).toBeVisible();
    await expect(canvas.getByText("PRESENT — UNREADABLE")).toBeVisible();
    await expect(canvas.getByTestId("row-assessment.tax_status")).toHaveTextContent(
      "not yet extracted",
    );
    await expect(canvas.getByText("NO PROVENANCE")).toBeVisible();
  },
};

/** Selection is ANNOUNCED, not merely tinted — a screen reader has no fill to see. */
export const Selected: Story = {
  args: { field: fieldAt("owner.zip"), onActivate: noop, selected: true },
  render: (args) => (
    <div className="max-w-200">
      <Card>
        <DecisionRow {...args} />
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("row-owner.zip")).toHaveAttribute("aria-current", "true");
  },
};
