import type { ClientsResponse, ConfigProduct } from "@titlepipe/contract";

import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { cn } from "../../shared/ui/classNames";

import {
  ABSENT_LABEL, ABSENT_SYMBOL, COMPARE_LEGEND,
  type CompareColumn, type CompareMark,
} from "./compare";
import { CompareMatrix } from "./CompareMatrix";
import { CompareStacked } from "./CompareStacked";
import { ProductChips } from "./ProductChips";

function LegendItem({
  symbol,
  label,
  swatch,
}: {
  symbol: string;
  label: string;
  swatch: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-3 border border-line-strong text-sm font-bold",
          swatch,
        )}
      >
        {symbol}
      </span>
      <span className="text-xs text-ink-secondary">{label}</span>
    </li>
  );
}

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
 * THE LEDE THEREFORE DEPARTS FROM THE EXPORT, DELIBERATELY. The design opens
 * "Every ACTIVE client against one product baseline"; this grid can only ever
 * show every RESOLVED one, and a sentence promising all active clients over a
 * grid that silently drops the unresolved ones is the more dangerous of the two
 * — a missing column would read as a client with nothing special about it. Not
 * a drift to be corrected back; the same reason the empty state names the
 * pairing the server resolved nothing for instead of blaming a retired client.
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

      {/*
        THE LEGEND NAMES SIX THINGS BECAUSE THE GRID DRAWS SIX. The five marks
        come from the resolver; the sixth is the dash — a line the client's
        resolved checklist does not carry at all. It used to be an empty cell
        and so had nothing to name, which meant the grid's one genuinely
        ambiguous cell was the only one the reader had no key for.
      */}
      <ul className="flex flex-wrap gap-7">
        {COMPARE_LEGEND.map((l) => (
          <LegendItem key={l.mark} symbol={l.symbol} label={l.label} swatch={SWATCH[l.mark]} />
        ))}
        <LegendItem
          symbol={ABSENT_SYMBOL}
          label={ABSENT_LABEL}
          swatch="bg-surface-app text-ink-muted"
        />
      </ul>

      {/*
        The testid rides a wrapper because the panel is now the shared one and
        takes no attributes. It has to keep its name: this is the state the
        screen's whole claim rests on — a matrix that is absent because the
        SERVER resolved nothing, not because the client filtered it away.
      */}
      {columns.length === 0 ? (
        <div data-testid="no-comparison">
          <EmptyPanel
            title={`No resolved comparison against ${product.full}.`}
            body="The matrix must come from the same resolver intake uses, and the server has resolved no client against this product — so nothing is guessed here."
          />
        </div>
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
