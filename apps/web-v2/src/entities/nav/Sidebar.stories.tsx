import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Sidebar, type SidebarSection } from "./Sidebar";
import type { SidebarDoorItem } from "./Sidebar";
import { doorGlyph, doorTitle, doorsFor, type Door } from "./doors";

const meta = {
  title: "Nav/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const brand = <span>TITLEPIPE</span>;

/**
 * Fixture stages exercise all three THIS ORDER states at once: Upload is a
 * plain numbered entry (no contract-cited stage maps to it — see the
 * CONTRACT GAP note in `orderLifecycle.ts`), Questions is `done` (its whole
 * job IS the `signoff` pipeline stage), and Completeness carries a
 * server-sourced badge (`gaps.length`) with no checkmark.
 */
/**
 * The doors are DERIVED, exactly as `AppChrome` derives them — a hand-written
 * fixture would carry hand-written squares, and a hand-written square cannot
 * catch two doors drawing the same letter. That collision is the one this rail
 * is least able to survive: collapsed, the square is all a row draws.
 */
const groupDoors = (group: Door["group"]): SidebarDoorItem[] =>
  doorsFor("admin")
    .filter((door) => door.group === group)
    .map((door) => ({
      to: door.path,
      label: door.label,
      icon: doorGlyph(door),
      title: doorTitle(door),
      active: door.path === "/queue",
      attention: door.path === "/escalations" ? "attend" : null,
    }));

const letterDoors = [...groupDoors("work"), ...groupDoors("admin"), ...groupDoors("reference")];

const sections: SidebarSection[] = [
  { kind: "doors", label: "WORK", doors: groupDoors("work") },
  {
    kind: "lifecycle",
    label: "THIS ORDER",
    stages: [
      { to: "/ingest", label: "Upload", active: false, attention: null, n: 1, done: false, badge: null },
      { to: "/questions", label: "Questions", active: false, attention: null, n: 2, done: true, badge: null },
      { to: "/processing", label: "Processing", active: false, attention: null, n: 3, done: false, badge: null },
      { to: "/completeness", label: "Completeness", active: false, attention: null, n: 4, done: false, badge: "1" },
      { to: "/orders/ord_demo_1/review", label: "Review", active: false, attention: null, n: 5, done: false, badge: "7" },
      { to: "/delivered", label: "Delivered", active: false, attention: null, n: 6, done: false, badge: null },
    ],
  },
  { kind: "doors", label: "ADMIN", doors: groupDoors("admin") },
  { kind: "doors", label: "REFERENCE", doors: groupDoors("reference") },
];

/** Expanded: all four group headers in order, a numbered rail with a checkmark
 * and a badge, and every door's letter-icon square visible alongside its label. */
export const Expanded: Story = {
  args: { collapsed: false, onToggle: () => {}, onNavigate: () => {}, brand, sections },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rail = await canvas.findByTestId("side-rail");
    await expect(rail).toHaveAttribute("data-collapsed", "0");

    // the four headers render, in order
    const headers = [...rail.querySelectorAll("h2")].map((el) => el.textContent);
    expect(headers).toEqual(["WORK", "THIS ORDER", "ADMIN", "REFERENCE"]);

    // THIS ORDER: a checkmark on the done stage, a bare number elsewhere
    const questions = await canvas.findByTestId("rail-door-/questions");
    expect(questions).toHaveTextContent("✓");
    const upload = await canvas.findByTestId("rail-door-/ingest");
    expect(upload).toHaveTextContent("1");

    // a server-sourced badge renders on the stage that carries one
    const completenessBadge = await canvas.findByTestId("rail-badge-/completeness");
    expect(completenessBadge).toHaveTextContent("1");
    const reviewBadge = await canvas.findByTestId("rail-badge-/orders/ord_demo_1/review");
    expect(reviewBadge).toHaveTextContent("7");
    // Upload/Processing/Delivered carry no badge — no contract source (CONTRACT GAP)
    expect(canvas.queryByTestId("rail-badge-/ingest")).not.toBeInTheDocument();
    expect(canvas.queryByTestId("rail-badge-/processing")).not.toBeInTheDocument();
    expect(canvas.queryByTestId("rail-badge-/delivered")).not.toBeInTheDocument();

    // every door shows its letter-icon square AND its label when expanded
    const queueDoor = await canvas.findByTestId("rail-door-/queue");
    expect(queueDoor).toHaveTextContent("Q");
    expect(queueDoor).toHaveTextContent("queue");
    // The square is the label's INITIAL; the chord `b` lives in the title and
    // the `?` map (ruling D2), so R here is the fix, not a typo.
    const rulebookDoor = await canvas.findByTestId("rail-door-/rulebook");
    expect(rulebookDoor).toHaveTextContent("R");
    expect(rulebookDoor).toHaveAttribute("title", "rulebook · g b");
    expect(rulebookDoor).toHaveTextContent("rulebook");
  },
};

/** Collapsed: headers disappear, icon squares remain the only content. */
export const Collapsed: Story = {
  args: { collapsed: true, onToggle: () => {}, onNavigate: () => {}, brand, sections },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rail = await canvas.findByTestId("side-rail");
    await expect(rail).toHaveAttribute("data-collapsed", "1");
    expect(rail.querySelectorAll("h2")).toHaveLength(0);
    const queueDoor = await canvas.findByTestId("rail-door-/queue");
    expect(queueDoor).toHaveTextContent("Q");

    // AT 78px THE SQUARE IS THE WHOLE ROW — no label is rendered — so two doors
    // sharing a letter are two rows nobody can tell apart without hovering.
    // Products keeps P and People draws its chord M (`glyphs.ts`).
    const squares = await Promise.all(
      letterDoors.map(async (door) =>
        (await canvas.findByTestId(`rail-door-${door.to}`)).textContent?.trim(),
      ),
    );
    expect(new Set(squares).size).toBe(squares.length);
    expect(squares).toContain("P");
    expect(squares).toContain("M");
  },
};
