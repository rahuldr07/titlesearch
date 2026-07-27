import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardHeader, CardBody, CardFooter } from "./Card";
import { Eyebrow } from "./Eyebrow";
import { Chip } from "./Chip";

const meta = {
  title: "Primitives/Card",
  component: Card,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Cards are separated by a BORDER, never elevation — `--shadow-card` has no
 * source in the export at all. Shadow is reserved for things that genuinely
 * float: the menu, the drawer, the expanded decision card, the page.
 */
export const Banded: Story = {
  args: { children: null },
  render: () => (
    <div className="max-w-160">
      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">Sign-off lines</Eyebrow>
          <Chip tone="attend" className="ml-auto">3 open</Chip>
        </CardHeader>
        <CardBody>
          <p className="text-base text-ink-secondary">
            Thirteen operational lines. The abstractor answers each one before
            the package enters the pipeline.
          </p>
        </CardBody>
        <CardFooter>Frozen against config v4 when the order was accepted.</CardFooter>
      </Card>
    </div>
  ),
};

export const Sizes: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-8 max-w-160">
      <Card size="card"><CardBody>card — 10px, the standard container</CardBody></Card>
      <Card size="emphasis"><CardBody>emphasis — 12px, rulebook detail and the failure card</CardBody></Card>
      <Card size="nested"><CardBody>nested — 8px, a card inside a card</CardBody></Card>
    </div>
  ),
};

/**
 * The 4px severity edge. `settled` deliberately has no accent: a settled state
 * is not something that needs pulling out of the page.
 */
export const Accents: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-8 max-w-160">
      <Card accent="halt"><CardBody>Package incomplete — the run is paused</CardBody></Card>
      <Card accent="attend"><CardBody>Provisional — this check has no evidence behind it</CardBody></Card>
      <Card accent="action"><CardBody>This order is the one you are working</CardBody></Card>
      <Card accent="none"><CardBody>No accent</CardBody></Card>
    </div>
  ),
};

export const Empty: Story = {
  args: { children: null },
  render: () => (
    <div className="max-w-160">
      <Card>
        <CardBody className="text-center">
          <p className="font-semibold">Nothing is waiting.</p>
          <p className="mt-2 text-sm text-ink-secondary">
            Work comes to you — the system decides which order is next.
          </p>
        </CardBody>
      </Card>
    </div>
  ),
};
