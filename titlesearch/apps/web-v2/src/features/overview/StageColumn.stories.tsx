import type { Meta, StoryObj } from "@storybook/react-vite";
import type { LifecycleStage } from "@titlepipe/contract";
import { expect, within } from "storybook/test";
import { StageColumn } from "./StageColumn";

const INTAKE: LifecycleStage = {
  id: "intake",
  label: "Intake & sign-off",
  sub: "answering the lines",
  waiting_on: "abstractor",
  kind: "halt",
  /** ONE larger than the card list on purpose — see `CensusIsNeverCardCount`. */
  count: 2,
  orders: [
    {
      id: "ord_demo_1",
      order_ref: "4176034-1",
      addr: "1147 E Saddlebrook Ln, Mesa AZ 85203",
      county: "Maricopa County · AZ",
      waited: "3h 12m",
      waiting_on: "Sign-off open",
      failed: false,
      mine: true,
      state_label: null,
    },
  ],
};

const MACHINE: LifecycleStage = {
  id: "machine",
  label: "Machine run",
  sub: "extracting fields",
  waiting_on: "machine",
  kind: "machine",
  count: 0,
  orders: [],
};

const meta = {
  title: "Overview/StageColumn",
  component: StageColumn,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StageColumn>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The header is FOUR lines: label + mono count, the server's sub-line, then the
 * mark beside the "on whom" caption. Folding the sub into the label
 * ("Intake · sign-off open") was the screen inventing a label format, and left
 * the rail with no way to show it at all.
 */
export const HeaderCarriesTheServersFourLines: Story = {
  args: { stage: INTAKE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("stage-label")).toHaveTextContent("Intake & sign-off");
    await expect(canvas.getByTestId("stage-sub")).toHaveTextContent("answering the lines");
    // "ON" is literal in the markup; the actor stays the server's word and is
    // only cased by the eyebrow, which is why this asserts the class too.
    const on = canvas.getByTestId("stage-waiting-on");
    await expect(on).toHaveTextContent("ON abstractor");
    await expect(on.className).toContain("uppercase");
    await expect(canvas.getByText("STOPPED")).toBeVisible();
  },
};

/** Your own order is findable on a seven-column board: badge and accented border. */
export const YourOwnOrderCarriesTheYoursBadge: Story = {
  args: { stage: INTAKE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("YOURS")).toBeVisible();
  },
};

/**
 * THE COUNT IS THE SERVER'S CENSUS AND IS NOT `orders.length`. The card list is
 * scoped to what this caller may open; the census is not. A count that shrank
 * with your permissions would read as work disappearing rather than as work you
 * are not allowed to look at — so the fixture ships two in the census and one
 * card, and the header must still say two.
 */
export const CensusIsNeverCardCount: Story = {
  args: { stage: INTAKE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("2")).toBeVisible();
    await expect(canvas.queryByText("1")).toBeNull();
  },
};

/**
 * The machine column is MACHINE-OWNED, and the export says so with a diagonal
 * hatch. The hatch is refused here: it already means "the document is silent on
 * this field", and one mark keeps one meaning. The replacement is a word, so it
 * survives greyscale, and the empty column still states what would sit in it.
 */
export const MachineOwnedIsAWordNotAHatch: Story = {
  args: { stage: MACHINE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("MACHINE")).toBeVisible();
    await expect(canvas.queryByText("STOPPED")).toBeNull();
    await expect(canvas.getByTestId("stage-sub")).toHaveTextContent("extracting fields");
    // Resolved and empty, never *not loaded* — and italic is what says so.
    const note = canvas.getByText("Nothing here");
    await expect(note.className).toContain("italic");
  },
};
