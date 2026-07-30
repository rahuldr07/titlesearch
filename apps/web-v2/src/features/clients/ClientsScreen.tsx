import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ScreenTitle } from "../../app/ScreenTitle";
import { useSession } from "../../shared/session";
import { Screen } from "../../shared/ui/Screen";
import { Tab, TabList, TabPanel, Tabs } from "../../shared/ui/Tabs";

import { clientsQuery, configProductsQuery } from "./queries";
import { CompareTab } from "./CompareTab";
import { OneClientTab } from "./OneClientTab";

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
  const [clientId, setClientId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);

  const clients = useQuery(clientsQuery);
  const config = useQuery(configProductsQuery);

  if (clients.isError || config.isError) {
    return (
      <Screen measure="880">
        <p className="text-base text-state-halt-ink">Client settings unavailable.</p>
      </Screen>
    );
  }
  if (clients.isPending || config.isPending) {
    return (
      <Screen measure="880">
        <p className="text-base text-ink-secondary">Loading client settings…</p>
      </Screen>
    );
  }

  // Open on a pairing the server has actually resolved. Landing on the "nobody
  // has told us how this resolves" state by default would read as a broken
  // screen rather than as the honest gap it is elsewhere.
  const selectedId = productId ?? clients.data.effective[0]?.product_id ?? "";
  const product =
    config.data.products.find((p) => p.id === selectedId) ?? config.data.products[0];
  const selectedClient = clientId ?? clients.data.clients[0]?.id ?? "";

  return (
    <Screen measure="880">
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

        {product === undefined ? (
          <p data-testid="no-products" className="text-base leading-body text-ink-secondary">
            The configuration carries no products, so there is no baseline to
            resolve a client against.
          </p>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabList variant="standalone">
              <Tab variant="standalone" value="one">One client in depth</Tab>
              <Tab variant="standalone" value="compare">Compare all clients</Tab>
            </TabList>

            <TabPanel value="one">
              <OneClientTab
                canAuthor={canAuthor}
                data={clients.data}
                config={config.data}
                clientId={selectedClient}
                product={product}
                onSelectClient={setClientId}
                onSelectProduct={setProductId}
              />
            </TabPanel>

            <TabPanel value="compare">
              <CompareTab
                data={clients.data}
                products={config.data.products}
                product={product}
                onSelectProduct={setProductId}
              />
            </TabPanel>
          </Tabs>
        )}
      </div>
    </Screen>
  );
}
