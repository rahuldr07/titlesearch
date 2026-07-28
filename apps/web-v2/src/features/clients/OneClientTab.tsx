import { Button } from "../../shared/ui/Button";
import { Chip } from "../../shared/ui/Chip";
import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";

import { EffectivePanel } from "./EffectivePanel";
import { OverridesPanel } from "./OverridesPanel";
import { SignoffDefaults } from "./SignoffDefaults";
import { CLIENTS, type ProductChip } from "./registry";

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
  clientId,
  onSelectClient,
  product,
  onSelectProduct,
}: {
  canAuthor: boolean;
  clientId: string;
  onSelectClient: (id: string) => void;
  product: ProductChip;
  onSelectProduct: (productId: string) => void;
}) {
  const client = CLIENTS.find((c) => c.id === clientId);

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
          {CLIENTS.map((c) => (
            <Toggle key={c.id} value={c.id} className="rounded-7">{c.name}</Toggle>
          ))}
        </ToggleGroup>
        {canAuthor ? (
          /* CONTRACT GAP: creating a client is a server write; no endpoint exists. */
          <Button className="ml-auto" disabled data-testid="new-client">
            ＋ New client
          </Button>
        ) : null}
      </div>

      {client === undefined ? (
        <div className="rounded-9 border border-dashed border-line-strong bg-surface-panel p-15 text-center">
          <p className="font-semibold text-ink-primary">No clients yet</p>
          <p className="mt-2 text-sm leading-body text-ink-secondary">
            Add the first client to set its sign-off defaults and overrides.
          </p>
          <Button size="lg" className="mt-7" disabled>＋ Add a client</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5">
            <p className="text-md">
              <span className="font-semibold text-ink-primary">{client.name}</span>{" "}
              <span className="text-ink-muted">· {client.contact}</span>
            </p>
            {client.retired ? <Chip tone="neutral" size="micro">Retired</Chip> : null}
            {canAuthor && !client.retired ? (
              /* CONTRACT GAP: editing and retiring a client are server writes with no endpoint. */
              <span className="ml-auto flex gap-3">
                <Button size="sm" fill="outlined" tone="neutral" disabled>
                  Edit client
                </Button>
                <Button
                  size="sm"
                  fill="outlined"
                  tone="neutral"
                  className="text-state-halt-ink"
                  disabled
                >
                  Retire
                </Button>
              </span>
            ) : null}
          </div>

          <SignoffDefaults clientName={client.name} />
          <OverridesPanel
            client={client}
            productName={product.name}
            canAuthor={canAuthor}
          />
          <EffectivePanel
            client={client}
            product={product}
            onSelectProduct={onSelectProduct}
          />
        </>
      )}
    </div>
  );
}
