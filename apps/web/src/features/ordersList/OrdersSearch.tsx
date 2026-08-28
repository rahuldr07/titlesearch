import { Button, Input } from "../../components/ui";
import type { OrdersBrowseState } from "./useOrdersBrowse";

/** Exactly the scopes `GET /api/orders` matches on. */
const SCOPES = "ref: address: client: stage: product: assigned:";

/** Uncontrolled. The term goes to the server; nothing here filters a row. */
export function OrdersSearch({ browse }: { readonly browse: OrdersBrowseState }) {
  const typing = browse.typed.length > 0;

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="relative w-170">
        <Input
          key={browse.resetKey}
          id="orders-search"
          aria-label="Search orders"
          aria-describedby={typing ? "orders-search-scopes" : undefined}
          className="pr-40"
          placeholder="Search — try client:riverbend stage:review, or a ref"
          onChange={(event) => {
            browse.type(event.target.value);
          }}
        />
        {typing && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1/2 right-2 -translate-y-1/2"
            onPress={() => {
              browse.clear();
            }}
          >
            Clear
          </Button>
        )}
      </div>
      {typing && (
        <span
          id="orders-search-scopes"
          className="font-mono text-label leading-flat text-ink-muted"
        >
          Scopes: {SCOPES} — terms combine with and
        </span>
      )}
    </div>
  );
}
