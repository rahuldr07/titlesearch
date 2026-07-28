import { useState } from "react";

import { useSession } from "../../shared/session";
import { Tab, TabList, TabPanel, Tabs } from "../../shared/ui/Tabs";

import { BaselineGrid } from "./BaselineGrid";
import { CONFIG_TABS } from "./catalogue";
import { ClientsLink } from "./ClientsLink";
import { ConfigHeader } from "./ConfigHeader";
import { EditDrawer, type EditTarget } from "./EditDrawer";
import { LineCatalogue } from "./LineCatalogue";
import { ProductList } from "./ProductList";

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

  return (
    <div className="flex flex-col gap-8">
      <ConfigHeader canAuthor={canAuthor} />

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
            canAuthor={canAuthor}
            onNew={() => setEditing({ kind: "product", mode: "new" })}
            onEdit={() => setEditing({ kind: "product", mode: "edit" })}
          />
        </TabPanel>

        <TabPanel value="lines">
          <LineCatalogue
            canAuthor={canAuthor}
            onNew={() => setEditing({ kind: "line", mode: "new" })}
            onEdit={() => setEditing({ kind: "line", mode: "edit" })}
          />
        </TabPanel>

        <TabPanel value="grid">
          <BaselineGrid canAuthor={canAuthor} />
        </TabPanel>

        <TabPanel value="clients">
          <ClientsLink />
        </TabPanel>
      </Tabs>

      {editing === null ? null : (
        <EditDrawer target={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
