import { cn } from "../../shared/ui/classNames";

import { COMPARE_LEGEND, type CompareMark } from "./compare";
import { CompareMatrix } from "./CompareMatrix";
import { CompareStacked } from "./CompareStacked";
import { RESOLVED_KEY } from "./effective";
import { ProductChips } from "./ProductChips";
import { CLIENTS, type ProductChip } from "./registry";

const SWATCH: Readonly<Record<CompareMark, string>> = {
  baseline: "bg-surface-app text-ink-muted",
  narrowed: "bg-state-attend-surface text-state-attend-ink",
  replaced: "bg-action-surface text-action-ink",
  waived: "bg-state-halt-surface text-state-halt-ink",
  added: "bg-state-settled-surface text-state-settled-ink",
};

/**
 * All active clients against one baseline.
 *
 * RETIRED CLIENTS ARE OUT. The grid's claim is "these are the differences that
 * are live", and a retired client's deltas are history — leaving them in would
 * inflate the set of things somebody thinks they have to reconcile.
 *
 * The legend is above the grid, not in a tooltip, because five marks is more
 * than anyone holds in their head and a mark you have to hover to decode is a
 * mark you will guess at instead.
 */
export function CompareTab({
  product,
  onSelectProduct,
}: {
  product: ProductChip;
  onSelectProduct: (productId: string) => void;
}) {
  const clients = CLIENTS.filter((c) => !c.retired);
  const resolved = product.gridKey === RESOLVED_KEY;

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-base leading-body text-ink-secondary">
        Every active client against one product baseline. A dot means that client
        takes the baseline as written — so the marks are the entire set of
        differences, and a column of dots is a client with nothing special about
        it.
      </p>

      <ProductChips value={product.id} onChange={onSelectProduct} />

      <ul className="flex flex-wrap gap-7">
        {COMPARE_LEGEND.map((l) => (
          <li key={l.mark} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-3 border border-line-strong text-sm font-bold",
                SWATCH[l.mark],
              )}
            >
              {l.symbol}
            </span>
            <span className="text-xs text-ink-secondary">{l.label}</span>
          </li>
        ))}
      </ul>

      {clients.length === 0 ? (
        <p className="rounded-9 border border-dashed border-line-strong bg-surface-panel p-13 text-center text-base text-ink-secondary">
          No active clients to compare. Add one, or un-retire an existing client.
        </p>
      ) : resolved ? (
        <>
          <div className="sm:hidden">
            <CompareStacked clients={clients} />
          </div>
          <div className="hidden sm:block">
            <CompareMatrix clients={clients} productName={product.name} />
          </div>
        </>
      ) : (
        <p
          data-testid="no-comparison"
          className="rounded-9 border border-dashed border-line-strong bg-surface-panel p-13 text-base leading-body text-ink-secondary"
        >
          No resolved comparison against {product.name}. CONTRACT GAP: the
          matrix must come from the same resolver intake uses, and there is no
          endpoint — the only transcribed fixture covers the year-search
          baseline, so nothing is guessed for the other products.
        </p>
      )}
    </div>
  );
}
