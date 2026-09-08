import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuLabel,
  sidebarDoorClass,
} from "./index";
import { tokenColour } from "./token-colour";

/**
 * The rail column's measurements, pinned: column 240 · door 38 high, radius
 * 14 · rubric 11px/700 at .14em tracking · door label 13px · active door
 * filled with the action colour under white. These are the values a future
 * edit is most likely to lose silently — every one still looks like a
 * sidebar when wrong.
 *
 * Plain anchors, not the routed `SidebarMenuLink`: that component lives in
 * `app/chrome/` because the kit may not import the route tree, and what is
 * under test here is the door's geometry, which is `sidebarDoorClass`. The
 * memory router this story used to mount tested Storybook, not the rail.
 */
function Rail() {
  return (
    <SidebarProvider collapsed={false} onCollapsedChange={() => {}}>
      <Sidebar label="Screens" testId="side-rail">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Pipeline</SidebarGroupLabel>
            <SidebarMenu>
              <a href="/" data-testid="door-overview" className={sidebarDoorClass(true)}>
                <SidebarMenuLabel>Overview</SidebarMenuLabel>
              </a>
              <a href="/" data-testid="door-queue" className={sidebarDoorClass(false)}>
                <SidebarMenuLabel>Queue</SidebarMenuLabel>
              </a>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

const meta = {
  title: "Kit/Sidebar",
  component: Rail,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Rail>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The column is 240px, which is the one width the design states outright. */
export const Column: Story = {
  play: async ({ canvas }) => {
    const rail = await canvas.findByTestId("side-rail");
    expect(rail.getBoundingClientRect().width).toBe(240);
  },
};

/** A door is 38px tall at radius 14 — the button recipe. */
export const DoorGeometry: Story = {
  play: async ({ canvas }) => {
    const door = await canvas.findByTestId("door-queue");
    expect(door.getBoundingClientRect().height).toBe(38);
    expect(getComputedStyle(door).borderRadius).toBe("14px");
    // The label is 13px (--text-meta). `text-sm` would emit no utility at
    // all — it would inherit and still look fine.
    expect(getComputedStyle(door).fontSize).toBe("13px");
  },
};

/**
 * All-caps at .14em is legal here and almost nowhere else — check-rules bans
 * `uppercase` outside rail rubrics and serif certificate headings. 11px at
 * .14em is 1.54px of tracking.
 */
export const RubricIsTrackedCaps: Story = {
  play: async ({ canvas }) => {
    const rubric = await canvas.findByRole("heading", { name: "Pipeline" });
    const style = getComputedStyle(rubric);
    // A rail rubric is all-caps — this asserts the legal case, and the line
    // scanner cannot tell an assertion about a class from the class.
    expect(style.textTransform).toBe("uppercase"); // rules-allow: asserts rule 4's legal rail-rubric case
    expect(style.fontSize).toBe("11px");
    expect(style.letterSpacing).toBe("1.54px");
    expect(style.fontWeight).toBe("700");
  },
};

/**
 * The active door is a solid accent fill under white; the resting door is
 * transparent, so "you are here" is fill and weight together. Expected
 * colours are read from the tokens, not written as hex — a hard hex is a
 * second copy of `--color-action` that passes when the component is wrong
 * the same way and fails when the palette is legitimately revalued.
 */
export const ActiveDoorIsFilled: Story = {
  play: async ({ canvas }) => {
    const active = await canvas.findByTestId("door-overview");
    const resting = await canvas.findByTestId("door-queue");
    expect(getComputedStyle(active).backgroundColor).toBe(tokenColour("--color-action"));
    expect(getComputedStyle(active).color).toBe(tokenColour("--color-ink-on-action"));
    expect(getComputedStyle(active).fontWeight).toBe("600");
    expect(getComputedStyle(active).backgroundColor).not.toBe(
      getComputedStyle(resting).backgroundColor,
    );
    expect(getComputedStyle(resting).fontWeight).toBe("400");
  },
};
