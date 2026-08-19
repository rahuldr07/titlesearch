import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useSession } from "../../shared/session";
import { Screen } from "../../shared/ui/Screen";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
import { Tab, TabList, TabPanel, Tabs } from "../../shared/ui/Tabs";

import { BaselineGrid } from "./BaselineGrid";
import { ClientsLink } from "./ClientsLink";
import { ConfigHeader } from "./ConfigHeader";
import { EditDrawer, type EditTarget } from "./EditDrawer";
import { LineCatalogue } from "./LineCatalogue";
import { ProductList } from "./ProductList";
import { configQuery } from "./queries";

const CONFIG_TABS = [
  { value: "products", label: "Products" },
  { value: "lines", label: "Sign-off lines" },
  { value: "grid", label: "Baseline grid" },
  { value: "clients", label: "Clients" },
] as const;

/**
 * The intake config layer: what a product asks for, and in whose words.
 *
 * Four tabs in one screen because they are one decision seen from four sides —
 * a line only means something as a cell in the grid, and a cell only means
 * something against a product. Splitting them into four screens would make the
 * common act (add a line, then decide who it applies to) a navigation problem.
 *
 * `standalone` tabs, not the inset segmented control: these switch WHICH thing
 * you are looking at, not a view of one thing.
 *
 * AUTHORING IS GATED CLIENT-SIDE ONLY AS A COURTESY. The server enforces the
 * admin/engineer rule independently and the read-only banner says so — this
 * screen must never be the thing standing between a reviewer and a write.
 */
export function ProductsScreen() {
  const role = useSession((s) => s.role);
  const canAuthor = role === "admin" || role === "engineer";

  const [tab, setTab] = useState<string>("products");
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const { data, isPending, isError } = useQuery(configQuery);

  if (isError) return <ScreenMessage tone="halt" measure="1040">Configuration unavailable.</ScreenMessage>;
  if (isPending) return <ScreenMessage measure="1040">Loading configuration…</ScreenMessage>;

  // The groups a line may belong to are the ones the catalogue already uses.
  // Offering a fixed list would let the drawer invent a group the server has
  // never seen, which is a vocabulary fork dressed as a form field.
  const groups = [...new Set(data.lines.map((l) => l.group))];

  return (
    <Screen measure="1040">
      <div className="flex flex-col gap-8">
        <ConfigHeader
          canAuthor={canAuthor}
          configVersion={data.config_version}
          frozen={data.frozen}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabList variant="standalone">
            {CONFIG_TABS.map((t) => (
              <Tab key={t.value} variant="standalone" value={t.value}>
                {t.label}
              </Tab>
            ))}
          </TabList>

          <TabPanel value="products">
            <ProductList
              products={data.products}
              canAuthor={canAuthor}
              onNew={() => setEditing({ kind: "product", mode: "new" })}
              onEdit={() => setEditing({ kind: "product", mode: "edit" })}
            />
          </TabPanel>

          <TabPanel value="lines">
            <LineCatalogue
              lines={data.lines}
              canAuthor={canAuthor}
              onNew={() => setEditing({ kind: "line", mode: "new" })}
              onEdit={() => setEditing({ kind: "line", mode: "edit" })}
            />
          </TabPanel>

          <TabPanel value="grid">
            <BaselineGrid products={data.products} lines={data.lines} canAuthor={canAuthor} />
          </TabPanel>

          <TabPanel value="clients">
            <ClientsLink />
          </TabPanel>
        </Tabs>

        {editing === null ? null : (
          <EditDrawer target={editing} groups={groups} onClose={() => setEditing(null)} />
        )}
      </div>
    </Screen>
  );
}
