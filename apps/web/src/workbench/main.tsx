/**
 * THE WORKBENCH. Dev-only, not routed, not shipped.
 *
 * Storybook shows one component at a time in isolation, which is the right
 * tool for building one and the wrong tool for judging the set. This page puts
 * every primitive on one surface so the things that only exist BETWEEN
 * components can be checked:
 *
 *   - press feedback, which a screenshot cannot show at all
 *   - whether hover on a Button and hover on a Tab feel like the same system
 *   - the tab ORDER through a realistic screen, in one pass, without clicking
 *   - whether the focus ring is visible on every one of them, including the
 *     composites react-aria renders as <div>
 *   - whether the accent really is spent once, when everything is in view
 *
 * Nothing here is a fixture for the app. Every value is obviously synthetic —
 * no order refs that look real, no party names — because a convincing mock is
 * how invented data escapes into a screen (AGENTS.md: never emit a value you
 * cannot cite).
 */

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { TextArea } from "../components/ui/TextArea";
import { Select } from "../components/ui/Select";
import { ComboBox } from "../components/ui/ComboBox";
import { Option } from "../components/ui/Option";
import { Checkbox, CheckboxGroup } from "../components/ui/Checkbox";
import { Radio, RadioGroup } from "../components/ui/RadioGroup";
import { Switch } from "../components/ui/Switch";
import { Kbd } from "../components/ui/Kbd";
import { Tabs, TabList, Tab, TabPanel } from "../components/ui/Tabs";
import { SegmentedControl, Segment } from "../components/ui/SegmentedControl";

import { Row } from "./Row";
import { SecondHalf } from "./SecondHalf";
import { DomainHalf } from "./DomainHalf";
import "../styles.css";

function Workbench() {
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState("all");
  const [radio, setRadio] = useState("b");

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
          <Button variant="quiet">Dismiss</Button>
          <Button variant="danger">Halt</Button>
          <Button variant="secondary" size="sm">Small</Button>
          <Button variant="secondary" size="lg">Large</Button>
          <Button variant="secondary" disabledBecause="Blocked: T1 second read not countersigned.">
            Blocked
          </Button>
        </Row>

        <Row title="Text entry" note="type here, then press a chord key — it must stay text">
          <div className="w-140"><Input label="Order reference" placeholder="TP-0000-0000" /></div>
          <div className="w-140"><Input label="Data value" data defaultValue="BK 4412 PG 88" /></div>
          <div className="w-140"><Input label="Refused" errorMessage="The server refused this value." /></div>
          <div className="w-160"><TextArea label="Reason" placeholder="Why this correction?" /></div>
        </Row>

        <Row title="Choice" note="open one and type — its typeahead must own the keys">
          <div className="w-120">
            <Select label="Absence" defaultSelectedKey="b">
              <Option id="a">Not used in this jurisdiction</Option>
              <Option id="b">Searched — nothing of record</Option>
              <Option id="c">Instrument is silent on it</Option>
              <Option id="d">On the page — could not be read</Option>
            </Select>
          </div>
          <div className="w-120">
            <ComboBox label="County">
              <Option id="a">Fulton</Option>
              <Option id="b">Shelby</Option>
              <Option id="c">San Diego</Option>
            </ComboBox>
          </div>
        </Row>

        <Row title="Toggles">
          <CheckboxGroup label="Layers" defaultValue={["a"]}>
            <Checkbox value="a">Quarantine passed</Checkbox>
            <Checkbox value="b">Optical profile read</Checkbox>
          </CheckboxGroup>
          <Checkbox isSelected={checked} onChange={setChecked}>Standalone</Checkbox>
          <RadioGroup label="Seat" value={radio} onChange={setRadio}>
            <Radio value="a">Seat A</Radio>
            <Radio value="b">Seat B</Radio>
          </RadioGroup>
          <Switch isSelected={on} onChange={setOn}>Follow evidence</Switch>
          <Switch disabledBecause="Blocked: no package loaded.">Blocked switch</Switch>
        </Row>

        <Row title="Navigation">
          <SegmentedControl label="Filter" selectedKeys={[seg]} onSelectionChange={(k) => setSeg([...k][0] as string)}>
            <Segment id="all">All</Segment>
            <Segment id="open">Open</Segment>
            <Segment id="settled">Settled</Segment>
          </SegmentedControl>
          <div className="w-210">
            <Tabs defaultSelectedKey="one">
              <TabList label="Stages">
                <Tab id="one">Intake</Tab>
                <Tab id="two">Extraction</Tab>
                <Tab id="three">Review</Tab>
              </TabList>
              <TabPanel id="one"><p className="text-meta text-ink-secondary">Panel one.</p></TabPanel>
              <TabPanel id="two"><p className="text-meta text-ink-secondary">Panel two.</p></TabPanel>
              <TabPanel id="three"><p className="text-meta text-ink-secondary">Panel three.</p></TabPanel>
            </Tabs>
          </div>
        </Row>

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
