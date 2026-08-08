import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabList, Tab, TabPanel } from "./Tabs";

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * `inset` switches a VIEW of the same thing. The 2px gap between the 7px track
 * radius and the 5px item radius is what makes the active item read as sitting
 * inside the track rather than on top of it.
 */
export const Inset: Story = {
  args: { children: null },
  render: () => (
    <Tabs defaultValue="queue">
      <TabList variant="inset">
        <Tab variant="inset" value="queue">
          Queue
        </Tab>
        <Tab variant="inset" value="overview">
          Overview
        </Tab>
        <Tab variant="inset" value="delivered">
          Delivered
        </Tab>
      </TabList>
      <TabPanel value="queue">One order at a time — the system decides which.</TabPanel>
      <TabPanel value="overview">Every order, by the stage it is stopped on.</TabPanel>
      <TabPanel value="delivered">
        Delivered reports, with every version retained.
      </TabPanel>
    </Tabs>
  ),
};

/** `standalone` switches WHICH thing you are looking at. */
export const Standalone: Story = {
  args: { children: null },
  render: () => (
    <Tabs defaultValue="lines">
      <TabList variant="standalone">
        <Tab variant="standalone" value="lines">
          Sign-off lines
        </Tab>
        <Tab variant="standalone" value="products">
          Products
        </Tab>
        <Tab variant="standalone" value="baseline">
          Baseline grid
        </Tab>
      </TabList>
      <TabPanel value="lines">Thirteen operational lines.</TabPanel>
      <TabPanel value="products">Six products.</TabPanel>
      <TabPanel value="baseline">The standard line set.</TabPanel>
    </Tabs>
  ),
};

export const Disabled: Story = {
  args: { children: null },
  render: () => (
    <Tabs defaultValue="a">
      <TabList variant="standalone">
        <Tab variant="standalone" value="a">
          Available
        </Tab>
        <Tab variant="standalone" value="b" disabled>
          Blocked on a ruling
        </Tab>
      </TabList>
      <TabPanel value="a">This tab is reachable.</TabPanel>
      <TabPanel value="b">Never shown.</TabPanel>
    </Tabs>
  ),
};
