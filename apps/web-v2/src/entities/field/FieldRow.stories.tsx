import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { FieldRow } from "./FieldRow";
import { FieldValue } from "./FieldValue";
import { NoValue } from "./NoValue";
import { Card } from "../../shared/ui/Card";

const meta = {
  title: "Field/FieldRow",
  component: FieldRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FieldRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const cited = { page: 3, snippet: "…" };

/**
 * SELECTION, NOT HOVER. There is no `:hover` rule on any table row anywhere in
 * the design — the active row is filled and that is the only row treatment.
 * A hover state would make every row the pointer crosses look momentarily
 * selected, on a screen where "which field am I deciding" is the whole question.
 *
 * Rows with no provenance are NOT clickable: a pointer cursor that leads
 * nowhere teaches the reviewer to distrust the one that works.
 */
export const AssembledReport: Story = {
  args: { label: "Lender", children: null },
  render: () => (
    <div className="max-w-200">
      <Card>
        <FieldRow label="Lender" onSelect={() => {}}>
          <FieldValue value="SPECIMEN LENDING CO (FIXTURE)" provenance={cited} />
        </FieldRow>
        <FieldRow label="Amount" selected onSelect={() => {}}>
          <FieldValue value="$220,224.00" provenance={cited} />
        </FieldRow>
        <FieldRow label="Plat book / page">
          <NoValue value={{ kind: "not_present" }} />
        </FieldRow>
        <FieldRow label="Case number">
          <NoValue value={{ kind: "unreadable", page: 31 }} />
        </FieldRow>
        <FieldRow label="Tax status">
          <NoValue value={{ kind: "pending" }} />
        </FieldRow>
        <FieldRow label="Judgment amount">
          <FieldValue value="$4,712.83" provenance={null} />
        </FieldRow>
      </Card>
    </div>
  ),
};

/**
 * The first `play` function in this codebase, and it exists for a measured
 * reason: a mutation audit deleted `aria-current` from this component and the
 * whole suite still reported green. Axe cannot catch it — a missing ARIA
 * attribute is not a rule violation, it is just less information — so nothing
 * but an explicit assertion will do.
 *
 * Selection is announced, not merely coloured. A reviewer using a screen reader
 * has no violet fill to look at.
 */
export const Selected: Story = {
  args: { label: "Amount", children: null },
  render: () => (
    <div className="max-w-200">
      <Card>
        <FieldRow label="Amount" selected onSelect={() => {}}>
          <FieldValue value="$220,224.00" provenance={cited} />
        </FieldRow>
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByRole("button", { name: /amount/i });
    await expect(label).toHaveAttribute("aria-current", "true");
  },
};

/** The same control must NOT claim to be current when it isn't. */
export const NotSelectedIsNotAnnounced: Story = {
  args: { label: "Lender", children: null },
  render: () => (
    <div className="max-w-200">
      <Card>
        <FieldRow label="Lender" onSelect={() => {}}>
          <FieldValue value="SPECIMEN LENDING CO (FIXTURE)" provenance={cited} />
        </FieldRow>
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByRole("button", { name: /lender/i });
    await expect(label).not.toHaveAttribute("aria-current");
  },
};

/** No provenance to travel to — the row renders, but offers no affordance. */
export const NotClickable: Story = {
  args: { label: "Tax status", children: null },
  render: () => (
    <div className="max-w-200">
      <Card>
        <FieldRow label="Tax status">
          <NoValue value={{ kind: "pending" }} />
        </FieldRow>
      </Card>
    </div>
  ),
};
