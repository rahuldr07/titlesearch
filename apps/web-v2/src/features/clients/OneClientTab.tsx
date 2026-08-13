import type {
  ClientsResponse,
  ConfigProduct,
  ConfigResponse,
} from "@titlepipe/contract";

import { Button } from "../../shared/ui/Button";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";

import { ClientIdentity } from "./ClientIdentity";
import { EffectivePanel } from "./EffectivePanel";
import { OverridesPanel } from "./OverridesPanel";
import { SignoffDefaults } from "./SignoffDefaults";

/**
 * One client, top to bottom: who they are, what they prefill, what they differ
 * on, and what an order therefore gets.
 *
 * The order of the three panels is the argument. Defaults are the mildest thing
 * a client can set (a suggestion), overrides are the deliberate differences,
 * and the effective list is the consequence — so reading down the page you see
 * the cause before the effect and can tell which delta produced which line.
 * Putting the resolved list first would make the deltas look like an
 * explanation invented after the fact.
 */
export function OneClientTab({
  canAuthor,
  data,
  config,
  clientId,
  product,
  onSelectClient,
  onSelectProduct,
}: {
  canAuthor: boolean;
  data: ClientsResponse;
  config: ConfigResponse;
  clientId: string;
  product: ConfigProduct;
  onSelectClient: (id: string) => void;
  onSelectProduct: (productId: string) => void;
}) {
  const client = data.clients.find((c) => c.id === clientId);
  const checklist = data.effective.find(
    (e) => e.client_id === clientId && e.product_id === product.id,
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center gap-4">
        <ToggleGroup
          aria-label="Client"
          value={[clientId]}
          onValueChange={(next) => {
            const picked = next[0];
            if (picked !== undefined) onSelectClient(picked);
          }}
        >
          {data.clients.map((c) => (
            <Toggle key={c.id} value={c.id} className="rounded-7">
              {c.name}
            </Toggle>
          ))}
        </ToggleGroup>
        {canAuthor ? (
          /* CONTRACT GAP: creating a client is a server write; the endpoint reads only. */
          <Button className="ml-auto" disabled data-testid="new-client">
            ＋ New client
          </Button>
        ) : null}
      </div>

      {/*
        RESOLVED AND EMPTY, never *not loaded*: the roster query has already
        answered by the time this tab renders, so stating "no clients yet" is a
        fact rather than a guess. The dashed panel is what carries that — a
        solid card would say "here is a thing" about a hole.
      */}
      {client === undefined ? (
        <EmptyPanel
          title="No clients yet"
          body="Add the first client to set its sign-off defaults and overrides."
          actions={
            <Button size="lg" disabled>
              ＋ Add a client
            </Button>
          }
        />
      ) : (
        <>
          <ClientIdentity client={client} canAuthor={canAuthor} />

          <SignoffDefaults
            clientName={client.name}
            defaults={client.signoff_defaults}
            lines={config.lines}
          />
          <OverridesPanel
            client={client}
            productName={product.full}
            lines={config.lines}
            canAuthor={canAuthor}
          />
          <EffectivePanel
            client={client}
            product={product}
            products={config.products}
            checklist={checklist}
            configVersion={config.config_version}
            onSelectProduct={onSelectProduct}
          />
        </>
      )}
    </div>
  );
}
