import { useState } from "react";

import { ScreenTitle } from "../../app/ScreenTitle";
import { useSession } from "../../shared/session";
import { Tab, TabList, TabPanel, Tabs } from "../../shared/ui/Tabs";

import { CompareTab } from "./CompareTab";
import { OneClientTab } from "./OneClientTab";
import { CLIENTS, DEFAULT_PRODUCT_ID, PRODUCT_CHIPS, type ProductChip } from "./registry";

const FALLBACK_PRODUCT: ProductChip = {
  id: DEFAULT_PRODUCT_ID, code: "40 Year", name: "40-Year Search", gridKey: "y",
};

/**
 * Client settings and overrides.
 *
 * A CLIENT HOLDS DELTAS, NEVER A COPY OF THE LIST. That is the whole design of
 * this screen and the reason it looks the way it does: a baseline change keeps
 * reaching every client automatically, and each difference stays visibly
 * deliberate instead of being buried in a duplicated checklist that quietly
 * stopped tracking the standard years ago.
 *
 * Two tabs, and they answer different questions. "One client in depth" is where
 * you author — it needs the defaults, the deltas and the resolution stacked in
 * causal order. "Compare all clients" is where you notice — one baseline, every
 * client, and the marks are the complete set of differences.
 *
 * The selected BASELINE is held here rather than per tab, because switching
 * tabs to answer "and what about the others" while silently changing which
 * product you were resolving against would make the two views disagree for a
 * reason nobody could see.
 */
export function ClientsScreen() {
  const role = useSession((s) => s.role);
  const canAuthor = role === "admin" || role === "engineer";

  const [tab, setTab] = useState<string>("one");
  const [clientId, setClientId] = useState<string>(CLIENTS[0]?.id ?? "");
  const [productId, setProductId] = useState<string>(DEFAULT_PRODUCT_ID);

  const product = PRODUCT_CHIPS.find((p) => p.id === productId) ?? FALLBACK_PRODUCT;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <ScreenTitle>Admin · Clients</ScreenTitle>
        <h1 className="mt-4 text-3xl font-semibold text-ink-primary">
          Client settings &amp; overrides
        </h1>
        <p className="mt-2 max-w-prose text-base leading-body text-ink-secondary">
          A client holds only <span className="font-semibold">deltas</span>{" "}
          against the product baseline — never a copy of the list. That way a
          baseline change keeps reaching every client, and each difference stays
          visibly deliberate.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabList variant="standalone">
          <Tab variant="standalone" value="one">One client in depth</Tab>
          <Tab variant="standalone" value="compare">Compare all clients</Tab>
        </TabList>

        <TabPanel value="one">
          <OneClientTab
            canAuthor={canAuthor}
            clientId={clientId}
            onSelectClient={setClientId}
            product={product}
            onSelectProduct={setProductId}
          />
        </TabPanel>

        <TabPanel value="compare">
          <CompareTab product={product} onSelectProduct={setProductId} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
