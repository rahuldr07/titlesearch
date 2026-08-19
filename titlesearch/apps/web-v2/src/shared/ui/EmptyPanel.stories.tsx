import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyPanel, EmptyNote } from "./EmptyPanel";
import { ScreenMessage } from "./ScreenMessage";
import { Button } from "./Button";
import { Card, CardHeader, CardBody } from "./Card";
import { Eyebrow } from "./Eyebrow";

const meta = {
  title: "Primitives/EmptyPanel",
  component: EmptyPanel,
  parameters: { layout: "padded" },
} satisfies Meta<typeof EmptyPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The first-run panel. The dash is doing real work: a solid card says "here is
 * a thing", and an empty product list is not a thing — it is a hole with an
 * instruction in it.
 *
 * Actions are a prop rather than children because the empty states differ —
 * products offer one way in, the line catalogue offers two (seed the standard
 * 13, or write your own) — and that choice is the point of the panel.
 */
export const WithActions: Story = {
  args: { title: "No products yet" },
  render: () => (
    <div className="max-w-215">
      <EmptyPanel
        title="No line catalogue yet"
        body="Seed the standard 13 operational lines, or write your own from scratch."
        actions={
          <>
            <Button size="lg">Seed the standard 13</Button>
            <Button size="lg" fill="outlined" tone="neutral">
              Start empty
            </Button>
          </>
        }
      />
    </div>
  ),
};

/** `body` and `actions` are both optional — the title alone is a full answer. */
export const TitleOnly: Story = {
  args: { title: "Nothing held" },
  render: () => (
    <div className="max-w-215">
      <EmptyPanel title="Nothing held" />
    </div>
  ),
};

/**
 * THE LINE THIS COMPONENT EXISTS TO DRAW. Left: the server answered and there
 * is nothing there. Right: nobody knows yet. They are different facts and they
 * must not be able to render as each other — "Nothing held" over a request
 * still in flight asserts something the app has not been told.
 */
export const ResolvedEmptyIsNotNotLoaded: Story = {
  args: { title: "Nothing held" },
  render: () => (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Eyebrow variant="group" as="h3">
          Resolved and empty — EmptyPanel
        </Eyebrow>
        <EmptyPanel
          title="Nothing held"
          body="No order on your account stopped and needs someone."
        />
      </div>
      <div className="flex flex-col gap-4">
        <Eyebrow variant="group" as="h3">
          Not loaded — ScreenMessage
        </Eyebrow>
        <ScreenMessage measure="860">Loading held orders…</ScreenMessage>
      </div>
    </div>
  ),
};

/**
 * `EmptyNote` is the same fact one register down: a line inside a container
 * that is otherwise doing its job. It carries no padding, so the column keeps
 * deciding its own spacing.
 */
export const Note: Story = {
  args: { title: "Nothing here" },
  render: () => (
    <div className="max-w-215">
      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">Segmentation · 0</Eyebrow>
        </CardHeader>
        <CardBody>
          <EmptyNote>Nothing here</EmptyNote>
        </CardBody>
      </Card>
    </div>
  ),
};
