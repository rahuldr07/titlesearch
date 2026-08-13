import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { OrderRow } from "../../entities/order/OrderRow";
import { Button } from "../../shared/ui/Button";
import { Chip } from "../../shared/ui/Chip";
import { Card } from "../../shared/ui/Card";
import { DividedSection } from "../../shared/ui/ListRow";
import { QueueBand } from "./QueueBand";

const meta = {
  title: "Queue/QueueBand",
  component: QueueBand,
  parameters: { layout: "padded" },
} satisfies Meta<typeof QueueBand>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The note carries the SERVER'S count — "4 stopped · needs someone", never
 * `orders.length`. A count of what is left is explicitly allowed (§4.5); this
 * band draws FOUR against a census of four rows it is not showing, which is the
 * whole reason the number is served rather than counted here.
 */
export const NoteCarriesTheServerCount: Story = {
  args: { title: "Held", note: "stopped · needs someone", count: 4, children: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("band-note")).toHaveTextContent(
      "4 stopped · needs someone",
    );
  },
};

/** No count served, no count drawn — "Next up" is the one order the server chose. */
export const NoCountServedDrawsNone: Story = {
  args: { title: "Next up", note: "the system decides — no picking", children: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("band-note")).toHaveTextContent(
      "the system decides — no picking",
    );
  },
};

/**
 * A held row: the state word the server sent, the reason it stopped, the waiting
 * stack, and an OPEN control — which opens the order, never claims it.
 */
export const HeldRowOpensAndDoesNotClaim: Story = {
  args: { title: "Held", note: "stopped · needs someone", count: 1, children: null },
  render: (args) => (
    <QueueBand {...args}>
      {/* The band's ONE sheet, as `BandOrders` builds it: rows are `<li>`s and a
          bare `OrderRow` outside a list is an a11y violation, not just a style
          one. `accent="attend"` is the held band's single severity mark. */}
      <Card accent="attend">
        <DividedSection>
          <OrderRow
            orderRef="4176011-2"
            chips={<Chip>Package incomplete</Chip>}
            place="72 Aldergate Rd, Fairhollow GA"
            where="Greene County · GA"
            note="Waiting on the abstractor to add documents"
            waited="1d 4h"
            /* `neutral`/`outlined`, the mockup's `.btn.line`. The bare
               `<Button>` this was is the wax default, and the wax is spent once
               per screen — on "Take next order", never on a row control. */
            action={
              <Button size="sm" tone="neutral" fill="outlined">
                Open →
              </Button>
            }
          />
        </DividedSection>
      </Card>
    </QueueBand>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("4176011-2")).toBeInTheDocument();
    await expect(canvas.getByText("WAITING")).toBeInTheDocument();
    await expect(canvas.getByText("1d 4h")).toBeInTheDocument();
    // The only control on a band row opens it. Nothing here claims, assigns or
    // reprioritises — `/api/queue/next` is the only hand-over.
    const controls = canvas.getAllByRole("button");
    await expect(controls).toHaveLength(1);
    await expect(controls[0]).toHaveAccessibleName("Open →");
  },
};

/**
 * A row nobody may act on draws NO control — absent, never disabled. A greyed
 * button invites someone to go and ask for permission; a missing one answers
 * them. The server also sent no duration, so the waiting stack is absent too
 * rather than printing a zero nobody measured.
 */
export const UnactionableRowDrawsNoControl: Story = {
  args: {
    title: "In flight",
    note: "processing · senior · ops view",
    count: 1,
    children: null,
  },
  render: (args) => (
    <QueueBand {...args}>
      <Card>
        <DividedSection>
          <OrderRow
            orderRef="4176048-3"
            place="441 Kestrel Ln, Brackendale NC"
            where="Mecklenburg County · NC"
            note="Extract fields"
          />
        </DividedSection>
      </Card>
    </QueueBand>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.queryByText("WAITING")).toBeNull();
  },
};
