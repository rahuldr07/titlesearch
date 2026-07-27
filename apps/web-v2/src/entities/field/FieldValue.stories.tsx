import type { Meta, StoryObj } from "@storybook/react-vite";
import { FieldValue } from "./FieldValue";

const meta = {
  title: "Field/FieldValue",
  component: FieldValue,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FieldValue>;

export default meta;
type Story = StoryObj<typeof meta>;

const cited = { page: 3, snippet: "…SOUTHSTONE MORTGAGE LLC…" };

export const Presentations: Story = {
  args: { value: "SOUTHSTONE MORTGAGE LLC", provenance: cited },
  render: () => (
    <div className="flex flex-col items-start gap-8">
      <FieldValue value="SOUTHSTONE MORTGAGE LLC" provenance={cited} />
      <FieldValue value="SOUTHSTONE MORTGAGE LLC" provenance={cited} presentation="correction" />
      <FieldValue value="ESTRADA, MARIA L" provenance={{ page: 31, snippet: "…" }} presentation="excluded" />
      <FieldValue value="$4,712.83" provenance={{ page: 32, snippet: "…" }} presentation="escalated" />
      <FieldValue
        value="Words line is legible and matches this reading."
        provenance={{ page: 3, snippet: "…" }}
        presentation="note"
      />
    </div>
  ),
};

/**
 * THE INVARIANT (`review.spec` #2): a value with no provenance renders as a
 * hard error — never a blank, never a bare value. Principle 6: never emit a
 * value you cannot cite.
 *
 * The design has NO arm for this, so the treatment is invented and flagged.
 * `provenance` is required-but-nullable rather than optional precisely so a
 * caller cannot omit it by accident and render an uncited value.
 */
export const NoProvenanceIsAnError: Story = {
  args: { value: "$220,224.00", provenance: null },
  render: () => (
    <div className="flex flex-col items-start gap-8">
      <FieldValue value="$220,224.00" provenance={null} />
    </div>
  ),
};

/**
 * `value_raw` and `value_normalized` are shown as SEPARATE values, never merged
 * (BRIEF §8). The normalisation is the machine's interpretation; a reviewer
 * checking against the page needs to see what was actually printed there.
 */
export const RawAndNormalised: Story = {
  args: { value: "$220,224.00", provenance: cited },
  render: () => (
    <div className="flex flex-col items-start gap-8">
      <FieldValue value="$220,224.00" raw="TWO HUNDRED TWENTY THOUSAND TWO HUNDRED TWENTY FOUR" provenance={cited} />
      <FieldValue value="03/15/2024" raw="March 15, A.D. 2024" provenance={{ page: 1, snippet: "…" }} />
    </div>
  ),
};
