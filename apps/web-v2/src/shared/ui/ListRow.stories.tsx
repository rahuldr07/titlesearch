import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardHeader } from "./Card";
import { Chip } from "./Chip";
import { DividedSection, ListRow } from "./ListRow";
import { Eyebrow } from "./Eyebrow";

const ROSTER = [
  { name: "M. Estrada", role: "Senior abstractor", status: "Active", tone: "settled" },
  { name: "J. Okafor", role: "Reviewer", status: "Invited", tone: "neutral" },
  { name: "P. Lindqvist", role: "Engineer", status: "Suspended", tone: "halt" },
] as const;

const CLUSTERS = [
  { path: "vesting.grantee", note: "4 unanswered · 3 orders" },
  { path: "legal.lot_block", note: "2 unanswered · 2 orders" },
  { path: "tax.parcel_id", note: "answered — the rule is in the book" },
] as const;

const meta = {
  title: "Primitives/ListRow",
  component: ListRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The shape three sites already draw byte-for-byte: a card, a banded header,
 * and rows whose only separator is the inner hairline. The first row carries no
 * top line — the header's own `border-b` is the line at that junction.
 */
export const InACard: Story = {
  args: { children: null },
  render: () => (
    <div className="max-w-180">
      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">People</Eyebrow>
          <Chip tone="attend" className="ml-auto">2 gated</Chip>
        </CardHeader>
        <DividedSection>
          {ROSTER.map((person) => (
            <ListRow key={person.name} className="flex flex-wrap items-center gap-7">
              <span className="min-w-100 flex-1 text-md font-semibold text-ink-primary">
                {person.name}
              </span>
              <span className="min-w-60 text-sm text-ink-secondary">{person.role}</span>
              <Chip tone={person.tone} size="sm" shape="tag">{person.status}</Chip>
            </ListRow>
          ))}
        </DividedSection>
      </Card>
    </div>
  ),
};

/**
 * `interactive` is for a row that IS the click target. The row zeroes its own
 * padding and hands it to the button so the whole width is clickable; the tint
 * repeats on `:focus-visible` so a keyboard user sees the row a mouse user
 * would, while the ring stays the app's single global focus treatment.
 */
export const Interactive: Story = {
  args: { children: null },
  render: () => (
    <div className="max-w-140">
      <Card>
        <DividedSection>
          {CLUSTERS.map((cluster) => (
            <ListRow key={cluster.path} interactive className="p-0">
              <button type="button" className="flex w-full flex-col gap-1 px-6 py-4 text-left">
                <span className="font-mono text-xs text-ink-primary">{cluster.path}</span>
                <span className="text-tiny text-ink-muted">{cluster.note}</span>
              </button>
            </ListRow>
          ))}
        </DividedSection>
      </Card>
    </div>
  ),
};

/** Two measured paddings, side by side. There is deliberately no third step. */
export const Densities: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-8 max-w-140">
      <Card>
        <DividedSection>
          <ListRow>18/11px — the mockup's queue row: people, products, stages</ListRow>
          <ListRow>and a second, so the hairline between them is visible</ListRow>
        </DividedSection>
      </Card>
      <Card>
        <DividedSection>
          <ListRow dense>15/9px — the mockup's decision row and the rail</ListRow>
          <ListRow dense>and a second, at the same tighter step</ListRow>
        </DividedSection>
      </Card>
    </div>
  ),
};

/**
 * WHY THE TWO GREYS ARE NOT INTERCHANGEABLE. Left is the rule: `line-strong`
 * around the card, `line-subtle` between the rows. Right swaps them, and the
 * list stops reading as one object and starts reading as a table.
 */
export const WrongRule: Story = {
  args: { children: null },
  render: () => (
    <div className="grid gap-8 max-w-200 sm:grid-cols-2">
      <Card>
        <DividedSection>
          <ListRow>Correct — the inner separator is line-subtle</ListRow>
          <ListRow>Second row</ListRow>
          <ListRow>Third row</ListRow>
        </DividedSection>
      </Card>
      <Card className="border-line-subtle">
        <DividedSection>
          <ListRow className="border-line-strong">Swapped — reads as a table</ListRow>
          <ListRow className="border-line-strong">Second row</ListRow>
          <ListRow className="border-line-strong">Third row</ListRow>
        </DividedSection>
      </Card>
    </div>
  ),
};
