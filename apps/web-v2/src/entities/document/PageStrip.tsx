import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * The pages read in full, with the current one marked.
 *
 * The header ratio ("11 of 64") is the honest part and must not be dropped: the
 * pipeline reads a fraction of a package in full, and a strip showing only the
 * 11 captured pages, with no denominator, implies the other 53 do not exist.
 * CONTEXT §5 puts median text-layer coverage well under 25% — the gap is the
 * normal case, not an error.
 *
 * Both numbers are SERVER-SUPPLIED. The client does not count pages.
 *
 * A11y: the current page carries `aria-current="page"`, so a screen-reader user
 * gets the same "you are here" the violet fill gives a sighted one.
 */
export function PageStrip({
  pages,
  totalPages,
  currentPage,
  onSelect,
}: {
  /** Pages read in full — server-supplied, already ordered. */
  pages: readonly number[];
  /** Total pages in the package, including those never read. */
  totalPages: number;
  currentPage: number;
  onSelect: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-4">
        <Eyebrow variant="caption">Pages read in full</Eyebrow>
        <span className="font-mono tnum text-xs text-ink-muted">
          {pages.length} of {totalPages}
        </span>
      </div>

      {pages.length === 0 ? (
        <p className="text-xs text-ink-secondary">
          No page in this package was read in full.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {pages.map((page) => {
            const current = page === currentPage;
            return (
              <button
                key={page}
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => onSelect(page)}
                className={cn(
                  "h-15 min-w-17 rounded-5 border px-4 font-mono tnum text-sm",
                  current
                    ? "border-action bg-action font-semibold text-ink-on-action"
                    : "border-line-strong bg-surface-panel text-ink-primary",
                )}
              >
                <span className="sr-only">Page </span>
                {page}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
