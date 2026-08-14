import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Sidebar, type SidebarSection } from "./Sidebar";
import type { SidebarDoorItem } from "./Sidebar";
import { doorGlyph, doorTitle, doorsFor, type Door } from "./doors";
import { Wordmark } from "../../shared/ui/Wordmark";

const meta = {
  title: "Nav/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * THE REAL MARK, INVERTED, because the placeholder was invisible. `<span>` alone
 * inherits `--color-ink-primary` from `html`, which on `bg-rail-surface`
 * measures 1.00:1 — identical luminance. This story draws the whole column, so
 * it was a screenshot of a rail with a hole where the wordmark goes.
 *
 * ⚠ AXE DOES NOT CATCH THIS ONE. Measured in this harness: it flags 1.01:1 and
 * 2.22:1, and PASSES at exactly 1.00:1, where equal luminance is treated as
 * deliberately hidden text. So the rail's headline failure mode — not faint,
 * gone — is precisely the case the Storybook a11y gate is blind to, and the
 * token assertions in `contrast.test.ts` are what actually cover it.
 */
const brand = <Wordmark size="rail" inverted />;

/**
 * Fixture stages exercise all three THIS ORDER states at once: Upload is a
 * plain numbered entry (no contract-cited stage maps to it — see the
 * CONTRACT GAP note in `orderLifecycle.ts`), Questions is `done` (its whole
 * job IS the `signoff` pipeline stage), and Completeness carries a
 * server-sourced badge (`gaps.length`) with no checkmark.
 */
/**
 * The doors are DERIVED, exactly as `AppChrome` derives them — a hand-written
 * fixture would carry hand-written marks, and a hand-written mark cannot catch
 * two doors drawing the same one. That collision is the one this rail is least
 * able to survive: collapsed, the mark is all a row draws.
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

const markedDoors = [...groupDoors("work"), ...groupDoors("admin"), ...groupDoors("reference")];

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
 * and a badge, and every door's icon visible alongside its label. */
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

    // every door shows its icon AND its label when expanded
    const queueDoor = await canvas.findByTestId("rail-door-/queue");
    expect(queueDoor).toHaveTextContent("▤");
    expect(queueDoor).toHaveTextContent("queue");
    // The mark is the mockup's ICON, not the chord and not the initial: `b`
    // opens the rulebook and lives in the title and the `?` map, `§` draws it.
    const rulebookDoor = await canvas.findByTestId("rail-door-/rulebook");
    expect(rulebookDoor).toHaveTextContent("§");
    expect(rulebookDoor).toHaveAttribute("title", "rulebook · g b");
    expect(rulebookDoor).toHaveTextContent("rulebook");
  },
};

/** Collapsed: headers disappear, the icons remain the only content. */
export const Collapsed: Story = {
  args: { collapsed: true, onToggle: () => {}, onNavigate: () => {}, brand, sections },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rail = await canvas.findByTestId("side-rail");
    await expect(rail).toHaveAttribute("data-collapsed", "1");
    expect(rail.querySelectorAll("h2")).toHaveLength(0);
    const queueDoor = await canvas.findByTestId("rail-door-/queue");
    expect(queueDoor).toHaveTextContent("▤");

    // AT 78px THE MARK IS THE WHOLE ROW — no label is rendered — so two doors
    // sharing one are two rows nobody can tell apart without hovering. This
    // asserts the rendered DOM; `doors.test.ts` asserts the catalogue that feeds
    // it, for every role. Both, because the rail could still drop a mark.
    const marks = await Promise.all(
      markedDoors.map(async (door) =>
        (await canvas.findByTestId(`rail-door-${door.to}`)).textContent?.trim(),
      ),
    );
    expect(new Set(marks).size).toBe(marks.length);
    expect(marks.every((mark) => mark !== undefined && mark.length > 0)).toBe(true);
  },
};
