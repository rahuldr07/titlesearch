import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { LifecycleRail, type LifecycleStage } from "./LifecycleRail";

const meta = {
  title: "Nav/LifecycleRail",
  component: LifecycleRail,
} satisfies Meta<typeof LifecycleRail>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A REVIEWER'S RAIL ON `/completeness`, as the server describes that order:
 * sign-off signed (`stages.signoff.phase === "done"`), the gate halted with
 * three gaps, review waiting on seven fields.
 *
 * IT STARTS AT 2. A reviewer holds no `/ingest`, so Upload is ABSENT — not
 * dimmed, not renumbered. The number is the structural position in the flow
 * (`flow.ts`), which is why Delivered is still six.
 */
const stages: LifecycleStage[] = [
  { to: "/questions", label: "Questions", active: false, attention: null, n: 2, done: true, badge: null },
  { to: "/processing", label: "Processing", active: false, attention: null, n: 3, done: false, badge: null },
  { to: "/completeness", label: "Completeness", active: true, attention: null, n: 4, done: false, badge: "3", badgeTone: "halt" },
  { to: "/orders/ord_demo_1/review", label: "Review", active: false, attention: null, n: 5, done: false, badge: "7", badgeTone: "attend" },
  { to: "/delivered", label: "Delivered", active: false, attention: null, n: 6, done: false, badge: null },
];

/**
 * The spine fills in BEHIND you and never ahead of you. The segment under a
 * done stage is green; every segment after the first not-done stage is grey,
 * however far down the rail the active row happens to be.
 */
export const OnCompleteness: Story = {
  args: { stages, collapsed: false, onNavigate: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // A done stage draws the checkmark and NOT its number.
    const questions = await canvas.findByTestId("rail-door-/questions");
    expect(questions).toHaveTextContent("✓");
    expect(questions).not.toHaveTextContent("2");

    // The segment BELOW the done stage is green…
    const behindDone = await canvas.findByTestId("rail-link-/processing");
    expect(behindDone).toHaveAttribute("data-done", "1");
    expect(behindDone.firstElementChild).toHaveClass("bg-state-settled");

    // …and the one after the not-done stage is NOT, even though the active row
    // sits below it. Colouring from "where you are standing" is the defect:
    // progress claimed by navigation is progress nobody recorded.
    const active = await canvas.findByTestId("rail-door-/completeness");
    expect(active).toHaveAttribute("data-active", "1");
    for (const to of ["/completeness", "/orders/ord_demo_1/review", "/delivered"]) {
      const link = await canvas.findByTestId(`rail-link-${to}`);
      expect(link, to).toHaveAttribute("data-done", "0");
      expect(link.firstElementChild, to).toHaveClass("bg-line-strong");
    }

    // The first row owns no segment — there is nothing behind Questions to
    // have finished. A leading stub would draw a step the reviewer never has.
    expect(canvas.queryByTestId("rail-link-/questions")).not.toBeInTheDocument();
    expect(canvas.queryByTestId("rail-door-/ingest")).not.toBeInTheDocument();

    // Tones ride WITH the badge; the pill never reads its own number.
    const gaps = await canvas.findByTestId("rail-badge-/completeness");
    expect(gaps).toHaveTextContent("3");
    expect(gaps).toHaveClass("bg-state-halt-surface");
    const needYou = await canvas.findByTestId("rail-badge-/orders/ord_demo_1/review");
    expect(needYou).toHaveClass("bg-state-attend-surface");
  },
};

/**
 * NO ORDER, NO PROGRESS. Off an order screen `AppChrome` hands every stage
 * `done: false` and `badge: null`, and the rail must then draw six plain
 * numbers on a grey spine — not a half-filled journey for an order nobody is
 * looking at.
 */
export const NoOrder: Story = {
  args: {
    collapsed: false,
    onNavigate: () => {},
    stages: stages.map((stage) => ({ ...stage, active: false, done: false, badge: null })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rail = await canvas.findByTestId("lifecycle-rail");
    expect(rail).not.toHaveTextContent("✓");
    for (const to of ["/processing", "/completeness", "/delivered"]) {
      expect(await canvas.findByTestId(`rail-link-${to}`), to).toHaveAttribute("data-done", "0");
    }
    expect(canvas.queryByTestId("rail-badge-/completeness")).not.toBeInTheDocument();
  },
};
