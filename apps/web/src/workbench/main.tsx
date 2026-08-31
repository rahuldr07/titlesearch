/**
 * The workbench. Dev-only, not routed, not shipped. Storybook shows one
 * component at a time; this page puts every primitive on one surface so the
 * things that only exist between components can be checked — press
 * feedback, whether hover feels like one system, the tab order in one pass,
 * the focus ring on every composite, and whether the accent really is spent
 * once. Nothing here is a fixture for the app: every value is obviously
 * synthetic, because a convincing mock is how invented data escapes into a
 * screen.
 */

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  Button,
  Checkbox,
  CheckboxGroup,
  Kbd,
  RadioGroup,
  RadioGroupItem,
  Segment,
  SegmentedControl,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
} from "../components/ui";

import { Row } from "./Row";
import { FormsHalf } from "./FormsHalf";
import { SecondHalf } from "./SecondHalf";
import { DomainHalf } from "./DomainHalf";
import "../styles.css";

function Workbench() {
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [radio, setRadio] = useState("b");
  const [pinned, setPinned] = useState(false);

  return (
    <div className="h-full overflow-auto bg-surface-app">
      <div className="mx-auto max-w-600 px-24 py-24">
        <header className="mb-20">
          <h1 className="text-title text-ink-primary">Component workbench</h1>
          <p className="mt-4 text-body text-ink-secondary">
            Hover, click and hold, and press <Kbd>Tab</Kbd> from the top. Press feedback is a
            1px settle with an inset shadow — never a bounce. The focus ring should appear on
            keyboard traversal and stay off a mouse press.
          </p>
        </header>

        <Row title="Button" note="one accent on the page — the rest are graphite">
          <Button variant="primary">Confirm</Button>
          <Button variant="secondary">Edit</Button>
          <Button variant="ghost">Dismiss</Button>
          <Button variant="halt">Halt</Button>
          <Button variant="secondary" size="sm">Small</Button>
          <Button variant="secondary" size="lg">Large</Button>
          <Button variant="secondary" icon aria-label="Next field">→</Button>
          <Button variant="secondary" disabledBecause="Blocked: T1 second read not countersigned.">
            Blocked
          </Button>
        </Row>

        <Row title="Toggles" note="a group is ONE answer — one accessible name, not four boxes">
          <CheckboxGroup aria-label="Layers" defaultValue={["a"]}>
            <Checkbox value="a">Quarantine passed</Checkbox>
            <Checkbox value="b">Optical profile read</Checkbox>
          </CheckboxGroup>
          <Checkbox isSelected={checked} onChange={setChecked}>Standalone</Checkbox>
          <RadioGroup aria-label="Seat" value={radio} onChange={setRadio}>
            <RadioGroupItem value="a">Seat A</RadioGroupItem>
            <RadioGroupItem value="b">Seat B</RadioGroupItem>
          </RadioGroup>
          <Switch isSelected={on} onChange={setOn}>Follow evidence</Switch>
          <Switch disabledBecause="Blocked: no package loaded.">Blocked switch</Switch>
          <Toggle isSelected={pinned} onChange={setPinned}>Pin panel</Toggle>
        </Row>

        <Row title="Navigation" note="arrow keys belong to the widget, not to the chord layer">
          <SegmentedControl label="Filter" defaultSelectedKeys={["all"]}>
            <Segment id="all">All</Segment>
            <Segment id="open">Open</Segment>
            <Segment id="settled">Settled</Segment>
          </SegmentedControl>
          <ToggleGroup label="Density" defaultSelectedKeys={["compact"]}>
            <ToggleGroupItem id="compact">Compact</ToggleGroupItem>
            <ToggleGroupItem id="roomy">Roomy</ToggleGroupItem>
          </ToggleGroup>
          <div className="w-210">
            <Tabs defaultSelectedKey="one">
              <TabList label="Stages">
                <Tab id="one">Intake</Tab>
                <Tab id="two">Extraction</Tab>
                <Tab id="three" disabledBecause="Blocked: extraction has not finished.">
                  Review
                </Tab>
              </TabList>
              <TabPanel id="one"><p className="text-meta text-ink-secondary">Panel one.</p></TabPanel>
              <TabPanel id="two"><p className="text-meta text-ink-secondary">Panel two.</p></TabPanel>
              <TabPanel id="three"><p className="text-meta text-ink-secondary">Panel three.</p></TabPanel>
            </Tabs>
          </div>
        </Row>

        <FormsHalf />
        <SecondHalf />
        <DomainHalf />
      </div>
    </div>
  );
}

const el = document.getElementById("workbench");
if (el !== null) {
  createRoot(el).render(
    <StrictMode>
      <Workbench />
    </StrictMode>,
  );
}
