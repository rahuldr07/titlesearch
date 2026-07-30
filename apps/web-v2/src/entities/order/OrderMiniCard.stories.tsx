import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { OrderMiniCard } from "./OrderMiniCard";

const meta = {
  title: "Order/OrderMiniCard",
  component: OrderMiniCard,
  parameters: { layout: "padded" },
} satisfies Meta<typeof OrderMiniCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * These assert the CLASS the card emits, not its computed style. Storybook
 * builds with its own Vite config and does not carry `@tailwindcss/vite`, so no
 * utility and no token resolves in this harness.
 */
const classOf = (el: HTMLElement) => el.className;

/** The four facts, in the order the board reads them. */
export const OnTheBoard: Story = {
  args: {
    ref: "4176011-2",
    place: "884 W Orange Grove Rd, Tucson AZ · Pima County · AZ",
    waited: "1d 4h",
    waitingOn: "Waiting on the abstractor to add documents",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("4176011-2")).toBeVisible();
    await expect(canvas.getByText("1d 4h")).toBeVisible();
    // The wait REASON is the card's reason to exist. A card that showed only
    // "how long" would be a lateness display, and lateness is not actionable.
    await expect(
      canvas.getByText("Waiting on the abstractor to add documents"),
    ).toBeVisible();
    await expect(canvas.queryByText("YOURS")).toBeNull();
  },
};

/**
 * WHERE THE SERVER SENT NOTHING, NOTHING IS DRAWN. The unassigned order has no
 * elapsed text on the wire, and the export prints "—" in its place. A dash
 * reads as a value the fixture failed to supply, so the whole footer goes
 * instead — principle 6, never emit a value you cannot cite.
 */
export const SilentWhereTheServerWasSilent: Story = {
  args: { ref: "4176052-7", place: "Pima County · AZ", waited: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("4176052-7")).toBeVisible();
    await expect(canvas.queryByText("—")).toBeNull();
    await expect(canvasElement.querySelectorAll("hr")).toHaveLength(0);
  },
};

/**
 * `mine` IS THE SERVER'S and is never guessed. It draws a badge as well as an
 * edge, so "yours" survives greyscale on a seven-column board — colour alone
 * would make the one card a person is looking for the one thing a monochrome
 * screen deletes.
 */
export const YoursIsAWordAsWellAsAnEdge: Story = {
  args: {
    ref: "4176034-1",
    place: "1147 E Saddlebrook Ln, Mesa AZ 85203",
    waited: "3h 12m",
    waitingOn: "Sign-off open",
    mine: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("YOURS")).toBeVisible();
    const card = canvas.getByText("4176034-1").closest("div")?.parentElement;
    await expect(classOf(card as HTMLElement)).toContain("border-action");
  },
};

/**
 * OFF THE PIPELINE. Panel ground with a halt hairline — the red TINT belongs to
 * the banner around the card, and grounding the card in it too would make the
 * block read as one solid alarm rather than as two failed orders in it.
 *
 * `state` is the server's word for where the order stands. A label and never an
 * enum: an enum invites `switch (state)` in the browser, which is the
 * client-side state machine hard rule 3 puts on the server.
 */
export const OffThePipeline: Story = {
  args: {
    ref: "4175998-9",
    state: "Failed validation",
    place: "Address unreadable on cover · Clayton County · GA",
    waited: "2d 1h",
    waitingOn: "Waiting on intake to re-upload",
    tone: "halt",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const state = canvas.getByText("Failed validation");
    await expect(classOf(state)).toContain("uppercase");
    await expect(classOf(state)).toContain("text-state-halt-ink");
    const card = canvas.getByText("4175998-9").closest("div")?.parentElement;
    await expect(classOf(card as HTMLElement)).toContain("border-state-halt-border");
  },
};
