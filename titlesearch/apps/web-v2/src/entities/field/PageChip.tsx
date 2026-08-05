import { cn } from "../../shared/ui/classNames";

/**
 * "This value was read from page N." Present on every cited value in the design.
 *
 * It is a real BUTTON, not a decorative span. Clicking it scrolls the document
 * pane to the cited line and highlights it, which is the fastest path from a
 * value to its evidence — and §6 requires every interactive element to be
 * keyboard reachable. A span with an onClick is neither focusable nor
 * announced, so a reviewer working by keyboard would lose click-to-source
 * entirely.
 *
 * The visible text is terse (`p47`) because it sits inline in dense rows; the
 * accessible name is the full sentence, so it is comprehensible out of context
 * when a screen reader lists the page's links and buttons.
 */
export function PageChip({
  page,
  onView,
  className,
}: {
  page: number;
  /**
   * Scrolls the document pane to the cited line and highlights it.
   * `| undefined` is explicit because `exactOptionalPropertyTypes` is on —
   * "absent" and "present but undefined" are different, and being forced to say
   * which is the point of the flag.
   */
  onView?: ((page: number) => void) | undefined;
  className?: string | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onView ? () => onView(page) : undefined}
      className={cn(
        "inline-flex items-center rounded-3 border px-3 py-1",
        "border-page-ref-border bg-page-ref-surface",
        "font-mono text-micro font-semibold text-page-ref",
        className,
      )}
    >
      <span className="sr-only">View the source for this value on page {page}</span>
      <span aria-hidden>p{page}</span>
    </button>
  );
}
