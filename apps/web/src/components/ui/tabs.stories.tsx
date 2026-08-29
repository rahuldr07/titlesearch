import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Tab, TabList, TabPanel, Tabs } from "./tabs";
import { onPanel } from "./kitGround";

/**
 * The five stage tabs on the order bar are the case this is built for, so the
 * stories use them rather than "Tab 1 / Tab 2".
 */
const meta = {
  title: "ui/Tabs",
  decorators: [onPanel],
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const stages = (
  <>
    <TabList label="Order stages">
      <Tab id="intake">Intake</Tab>
      <Tab id="extract">Extract</Tab>
      <Tab id="review">Review</Tab>
      <Tab id="assemble">Assemble</Tab>
      <Tab id="release">Release</Tab>
    </TabList>
    <TabPanel id="intake">Package received, 41 documents.</TabPanel>
    <TabPanel id="extract">28 fields read, 6 unreadable.</TabPanel>
    <TabPanel id="review">2 fields escalated.</TabPanel>
    <TabPanel id="assemble">Assembly blocked on an OPEN judgment.</TabPanel>
    <TabPanel id="release">Not yet released.</TabPanel>
  </>
);

/** Resting, first stage selected. */
export const Default: Story = { args: { children: stages } };

/**
 * SELECTION IS A STROKE, NOT A FILL — rule 1. The registry drew
 * `data-selected:bg-background` inside a `bg-muted` track, which is a filled
 * pill, and a filled tab spends the once-per-screen accent budget on
 * navigation. The assertion is that the selected tab carries a BORDER class and
 * no background fill.
 */
export const SelectedIsAnUnderline: Story = {
  args: { defaultSelectedKey: "review", children: stages },
  play: async () => {
    const selected = document.querySelector("[aria-selected='true']");
    const cls = selected?.getAttribute("class") ?? "";
    expect(cls).toContain("data-selected:border-action");
    expect(cls).not.toMatch(/data-selected:bg-/);
  },
};

/**
 * RULE 12: a stage the reader may not open yet renders DISABLED WITH THE RULE,
 * never hidden. Hiding it would also silently renumber the stages, which is
 * the second reason and the one a screenshot shows.
 */
export const StageBlocked: Story = {
  args: {
    children: (
      <>
        <TabList label="Order stages">
          <Tab id="intake">Intake</Tab>
          <Tab id="release" disabledBecause="Blocked: assembly has an OPEN judgment.">
            Release
          </Tab>
        </TabList>
        <TabPanel id="intake">Package received.</TabPanel>
        <TabPanel id="release">Not yet released.</TabPanel>
      </>
    ),
  },
  play: async () => {
    const reason = "Blocked: assembly has an OPEN judgment.";
    /*
     * BOTH tabs must still be in the strip. This is the assertion that caught
     * a real defect: wrapping the Tab in `BlockedHint` to carry `title` made
     * react-aria's CollectionBuilder stop seeing it, and the blocked stage
     * VANISHED — rule 12 broken in the act of satisfying rule 9. See tabs.tsx.
     */
    expect(document.querySelectorAll("[data-slot='tabs-trigger']")).toHaveLength(2);
    const tab = document.querySelector("[data-slot='tabs-trigger'][data-disabled-reason]");
    expect(tab?.getAttribute("data-disabled-reason")).toBe(reason);
    // Rule 12 again: blocked, not hidden.
    expect(tab?.textContent).toContain("Release");
  },
};

/**
 * THE CHORD CONTRACT, AND THE VALUE IS `widget`.
 *
 * `focusRoles.ts` records this as the mistake nearly made while fixing B3: a
 * tab strip is mounted at ALL TIMES, and `own` is read document-wide by
 * `overlayIsUp()`, so marking it `own` would leave every chord in the app
 * permanently dead. Both halves are asserted.
 */
export const OwnsKeysOnlyWhileFocused: Story = {
  args: { children: stages },
  play: async () => {
    expect(document.querySelector("[data-chord-scope='widget']")).not.toBe(null);
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
    expect(document.querySelector("[role='tablist']")).not.toBe(null);
    expect(document.querySelector("[role='tab']")).not.toBe(null);
  },
};
