import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabList, Tab, TabPanel } from "./Tabs";

/**
 * The selected tab is an underline plus weight, never a filled capsule: the
 * accent is the only solid fill in this palette and rule 1 spends it on the
 * decision, not on navigation.
 */
const meta = {
  title: "ui/Tabs",
  component: Tabs,
  // `children` is required on Tabs, and a render-only story does not exempt a
  // story from the args type. Set once here rather than in each story.
  args: { children: null },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FiveStages: Story = {
  render: () => (
    <Tabs>
      <TabList label="Order stages">
        <Tab id="intake">Intake</Tab>
        <Tab id="extraction">Extraction</Tab>
        <Tab id="examination">Examination</Tab>
        <Tab id="release">Release</Tab>
        <Tab id="delivered">Delivered</Tab>
      </TabList>
      <TabPanel id="intake">Quarantine gateway and optical profile.</TabPanel>
      <TabPanel id="extraction">Sequential stages and the page matrix.</TabPanel>
      <TabPanel id="examination">Field rulings and the second read.</TabPanel>
      <TabPanel id="release">Certificate and release gate.</TabPanel>
      <TabPanel id="delivered">Deliverables and the version ledger.</TabPanel>
    </Tabs>
  ),
};

/** Rule 12: a stage the reader may not open yet is disabled WITH the rule,
    never hidden — hiding it would silently renumber the stages. */
export const StageBlockedWithReason: Story = {
  render: () => (
    <Tabs defaultSelectedKey="intake">
      <TabList label="Order stages">
        <Tab id="intake">Intake</Tab>
        <Tab id="extraction" disabledBecause="Blocked: quarantine has not passed.">
          Extraction
        </Tab>
        <Tab id="release" disabledBecause="Blocked: 4 fields are still open.">
          Release
        </Tab>
      </TabList>
      <TabPanel id="intake">Quarantine gateway and optical profile.</TabPanel>
    </Tabs>
  ),
};
