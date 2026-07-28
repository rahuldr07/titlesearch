import type { ClientsResponse, ConfigProduct } from "@titlepipe/contract";

import { cn } from "../../shared/ui/classNames";

import { COMPARE_LEGEND, type CompareColumn, type CompareMark } from "./compare";
import { CompareMatrix } from "./CompareMatrix";
import { CompareStacked } from "./CompareStacked";
import { ProductChips } from "./ProductChips";

const SWATCH: Readonly<Record<CompareMark, string>> = {
  baseline: "bg-surface-app text-ink-muted",
  narrowed: "bg-state-attend-surface text-state-attend-ink",
  replaced: "bg-action-surface text-action-ink",
  waived: "bg-state-halt-surface text-state-halt-ink",
  added: "bg-state-settled-surface text-state-settled-ink",
};

/**
 * Every client the server has resolved against one baseline.
 *
 * A CLIENT WITH NO RESOLVED CHECKLIST GETS NO COLUMN. The grid's claim is that
 * it cannot disagree with what an order actually gets, which is only true while
 * every mark on it came from the resolver — so an unresolved pairing is absent
 * rather than filled in with plausible dots.
 *
 * The legend is above the grid, not in a tooltip, because five marks is more
 * than anyone holds in their head and a mark you have to hover to decode is a
 * mark you will guess at instead.
 */
export function CompareTab({
  data,
  products,
  product,
  onSelectProduct,
}: {
  data: ClientsResponse;
  products: readonly ConfigProduct[];
  product: ConfigProduct;
  onSelectProduct: (productId: string) => void;
}) {
  const columns: CompareColumn[] = data.effective
    .filter((e) => e.product_id === product.id)
    .flatMap((checklist) => {
      const client = data.clients.find((c) => c.id === checklist.client_id);
      return client === undefined ? [] : [{ client, checklist }];
    });

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-base leading-body text-ink-secondary">
        Every client the server has resolved against one product baseline. A dot
        means that client takes the baseline as written — so the marks are the
        entire set of differences, and a column of dots is a client with nothing
        special about it.
      </p>

      <ProductChips products={products} value={product.id} onChange={onSelectProduct} />

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

      {columns.length === 0 ? (
        <p
          data-testid="no-comparison"
          className="rounded-9 border border-dashed border-line-strong bg-surface-panel p-13 text-base leading-body text-ink-secondary"
        >
          No resolved comparison against {product.full}. The matrix must come
          from the same resolver intake uses, and the server has resolved no
          client against this product — so nothing is guessed here.
        </p>
      ) : (
        <>
          <div className="sm:hidden">
            <CompareStacked columns={columns} />
          </div>
          <div className="hidden sm:block">
            <CompareMatrix columns={columns} productName={product.full} />
          </div>
        </>
      )}
    </div>
  );
}
