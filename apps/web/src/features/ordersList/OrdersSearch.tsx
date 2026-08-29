import { Button, Input } from "../../components/ui";
import type { OrdersBrowseState } from "./useOrdersBrowse";

/** Exactly the scopes `GET /api/orders` matches on. */
const SCOPES = "ref: address: client: stage: product: assigned:";

/**
 * Uncontrolled. The term goes to the server; nothing here filters a row.
 *
 * `matches` is the server's `total` for the term it echoed back — never a row
 * count, and absent while the read for a newly settled term is in flight, so
 * the line never reports the previous term's tally under the new one.
 *
 * The design carries the scope list twice: a `title` tooltip that is always
 * there, and a hint line that appears once a term is typed. `Input` is a
 * react-aria control and DROPS a `title` prop silently — measured, the
 * attribute never reaches the DOM — so the two are collapsed into one line that
 * is always drawn, and the tally joins it when there is a term to count.
 */
export function OrdersSearch({
  browse,
  matches,
}: {
  readonly browse: OrdersBrowseState;
  readonly matches: number | undefined;
}) {
  const typing = browse.typed.length > 0;
  const note = `${SCOPES} — terms combine with and`;
  const hint =
    matches === undefined
      ? `Scopes: ${note}`
      : `${matches} ${matches === 1 ? "match" : "matches"} · scopes: ${note}`;

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="relative w-170">
        <Input
          key={browse.resetKey}
          id="orders-search"
          aria-label="Search orders"
          aria-describedby="orders-search-scopes"
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
      <span
        id="orders-search-scopes"
        className="font-mono text-label leading-flat text-ink-muted"
      >
        {hint}
      </span>
    </div>
  );
}
