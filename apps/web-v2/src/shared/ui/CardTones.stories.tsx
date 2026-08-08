import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardBody } from "./Card";

/**
 * The card's three SEMANTIC axes — tone, accent, dashed — split from
 * `Card.stories.tsx` (structure and density) so each catalogue stays inside
 * the file cap. Same component, same rules.
 */
const meta = {
  title: "Primitives/Card tones",
  component: Card,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The tinted semantic block — a `-surface` ground with the SAME family's pale
 * `-border` hairline. Passing the two separately is what lets a pale ground end
 * up fenced by a saturated edge, which the export does 34 times.
 */
export const Tones: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-8 max-w-160">
      <Card tone="none">
        <CardBody>none — the ordinary panel</CardBody>
      </Card>
      <Card tone="action">
        <CardBody>action — this is the order you are working</CardBody>
      </Card>
      <Card tone="attend">
        <CardBody>attend — escalated, disclosed, look at this</CardBody>
      </Card>
      <Card tone="halt">
        <CardBody>halt — stopped, and there is something to do</CardBody>
      </Card>
      <Card tone="settled">
        <CardBody>settled — confirmed, no action left</CardBody>
      </Card>
    </div>
  ),
};

/**
 * The 2px accent stripe sits on the TOP edge and means "this block is the live
 * one". The 4px LEFT edge is the severity axis and belongs to banners; drawing
 * accent there made every accented card compete with the real alarms.
 */
export const Accents: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-8 max-w-160">
      <Card accent="halt">
        <CardBody>Package incomplete — the run is paused</CardBody>
      </Card>
      <Card accent="attend">
        <CardBody>Escalated — a person has to answer this</CardBody>
      </Card>
      <Card accent="action">
        <CardBody>This order is the one you are working</CardBody>
      </Card>
      <Card accent="settled">
        <CardBody>Signed off — the live block, and it is done</CardBody>
      </Card>
      <Card accent="none">
        <CardBody>No accent</CardBody>
      </Card>
    </div>
  ),
};

/**
 * `dashed` means PROVISIONAL — proposed, with no document behind it yet. Solid
 * is the mark of a settled thing, so a proposal drawn solid reads as a finding.
 */
export const Provisional: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-8 max-w-160">
      <Card tone="attend" dashed>
        <CardBody>Proposed rule — not yet confirmed by an engineer</CardBody>
      </Card>
      <Card tone="attend">
        <CardBody>Confirmed rule — this one is evidence</CardBody>
      </Card>
    </div>
  ),
};
