import type { OrdersPageResponse } from "@titlepipe/contract";
import { Button } from "../../components/ui";

/**
 * `total` and `page_count` arrive on the response and are printed as they came.
 * The window is the server's `page` and `page_size` plus the rows it sent — no
 * length is ever divided by a page size here.
 */
export function OrdersPager({
  data,
  goToPage,
}: {
  readonly data: OrdersPageResponse;
  readonly goToPage: (page: number) => void;
}) {
  const first = (data.page - 1) * data.page_size + 1;
  const last = first + data.orders.length - 1;
  const pages = Array.from({ length: data.page_count }, (_, index) => index + 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-6 border-t border-line-subtle bg-control-fill px-8 py-6">
      <span className="font-mono text-meta leading-close text-ink-secondary">
        {data.total === 0 ? "0 orders" : `Showing ${first}–${last} of ${data.total}`}
      </span>
      <nav aria-label="Order pages" className="flex items-center gap-3">
        <Button
          size="sm"
          disabledBecause={data.page === 1 ? "This is the first page." : undefined}
          onPress={() => {
            goToPage(data.page - 1);
          }}
        >
          ← Prev
        </Button>
        {pages.map((page) => (
          <Button
            key={page}
            size="sm"
            variant={page === data.page ? "primary" : "secondary"}
            aria-current={page === data.page}
            aria-label={`Page ${page} of ${data.page_count}`}
            onPress={() => {
              goToPage(page);
            }}
          >
            {page}
          </Button>
        ))}
        <Button
          size="sm"
          disabledBecause={
            data.page >= data.page_count ? "This is the last page." : undefined
          }
          onPress={() => {
            goToPage(data.page + 1);
          }}
        >
          Next →
        </Button>
      </nav>
    </div>
  );
}
