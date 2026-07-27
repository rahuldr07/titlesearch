import { useState } from "react";
import { RulebookTab } from "./RulebookTab";
import { MeTab } from "./MeTab";
import { AuditTab } from "./AuditTab";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Tabs, TabList, Tab, TabPanel } from "../../shared/ui/Tabs";

/**
 * The account layer: the rulebook, your own world, and the audit log.
 *
 * Rulebook is the default tab because it is the one a reviewer arrives for —
 * "what is the rule here" is the question this screen mostly answers, and the
 * harvested specs open `/account` and expect a rule immediately.
 *
 * Tabs are `standalone` rather than the inset segmented control: these switch
 * WHICH thing you are looking at, not a view of one thing.
 */
export function AccountScreen() {
  const [tab, setTab] = useState("rulebook");

  return (
    <div className="flex flex-col gap-8">
      <Eyebrow variant="screen">Account</Eyebrow>

      <Tabs value={tab} onValueChange={setTab}>
        <TabList variant="standalone">
          <Tab variant="standalone" value="rulebook">Rulebook</Tab>
          <Tab variant="standalone" value="me">Me</Tab>
          <Tab variant="standalone" value="audit">Audit</Tab>
        </TabList>

        <TabPanel value="rulebook"><RulebookTab /></TabPanel>
        <TabPanel value="me"><MeTab /></TabPanel>
        <TabPanel value="audit"><AuditTab /></TabPanel>
      </Tabs>
    </div>
  );
}
