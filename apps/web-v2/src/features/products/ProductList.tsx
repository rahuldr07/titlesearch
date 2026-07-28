import type { ConfigProduct, Derivation } from "@titlepipe/contract";

import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

import { EmptyState } from "./EmptyState";

/** The derivation code, in words. The server sends the code; this reads it. */
const DERIVATION: Readonly<Record<Derivation, string>> = {
  cos: "current owner",
  tos: "two owners",
  update: "since the prior search",
  y: "fixed years back",
};

/**
 * Products, as a flat list with the PERIOD DERIVATION printed under each name.
 *
 * The derivation is on the row rather than behind an edit click because it is
 * the thing that distinguishes two products whose names look interchangeable —
 * a two-owner search and a 30-year search answer nearly the same lines and
 * compute completely different windows. Hiding it would make the list look like
 * four labels for one product.
 *
 * There is no delete. Retire is the only exit, so an order that was run against
 * a product keeps a product to point at; a deleted product turns every historic
 * order into a dangling reference.
 */
export function ProductList({
  products,
  canAuthor,
  onNew,
  onEdit,
}: {
  products: readonly ConfigProduct[];
  canAuthor: boolean;
  onNew: () => void;
  onEdit: () => void;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-5">
        <Eyebrow variant="section" as="h2">Products</Eyebrow>
        {canAuthor ? (
          <Button className="ml-auto" data-testid="new-product" onClick={onNew}>
            ＋ New product
          </Button>
        ) : null}
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          body="A product decides which lines apply and how each period is derived. Add the first one."
        >
          <Button size="lg" onClick={onNew}>＋ Add a product</Button>
        </EmptyState>
      ) : (
        <Card>
          <ul>
            {products.map((p) => (
              <li
                key={p.id}
                data-testid={`product-${p.id}`}
                className={cn(
                  "flex flex-wrap items-center gap-7 border-t border-line-subtle px-8 py-6 first:border-t-0",
                  p.retired && "opacity-55",
                )}
              >
                <span className="w-37 shrink-0 font-mono text-sm font-semibold text-ink-primary">
                  {p.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-md font-medium text-ink-primary">{p.full}</span>
                  <span className="mt-1 block text-xs text-ink-secondary">{p.sub}</span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    Period: {p.period} · derived from {DERIVATION[p.derivation]}
                  </span>
                </span>
                {p.retired ? <Chip tone="neutral" size="micro">Retired</Chip> : null}
                {canAuthor && !p.retired ? (
                  <span className="flex gap-3">
                    <Button size="sm" fill="outlined" tone="neutral" onClick={onEdit}>
                      Edit
                    </Button>
                    {/*
                      CONTRACT GAP: retiring a product is a server write with no
                      endpoint. Left visible and disabled rather than removed —
                      the row's shape is what tells you retirement exists at all.
                    */}
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
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs leading-body text-ink-muted">
        CONTRACT GAP: the products endpoint is READ ONLY. These records come from
        the server, but nothing here writes — retire is disabled, and the editor
        opens a form the server cannot yet accept.
      </p>
    </section>
  );
}
