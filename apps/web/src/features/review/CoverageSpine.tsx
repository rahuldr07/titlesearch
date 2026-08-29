import type { SourcePage } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**

 * INVARIANT 34: "The coverage spine renders ONE CELL PER PACKAGE PAGE, not just read

 * ones." axe reports one `target-size` violation per cell — 64 of them, measured at

 * 6.7 x 20px each. That is not sloppiness and it is not fixable by…

 */
function describe(n: number, page: SourcePage | undefined): string {
  if (page === undefined) return `Page ${n} — no reader read this page`;
  if (page.degraded)
    return `Page ${n} — ${page.kind} · the server marked this scan degraded`;
  if (!page.read_in_full) return `Page ${n} — ${page.kind} · not read in full`;
  return `Page ${n} — ${page.kind} · read`;
}

function paint(page: SourcePage | undefined): string {
  if (page === undefined) return "border-line-strong bg-surface-sunken";
  if (page.degraded) return "border-state-halt-border bg-state-halt-surface";
  if (!page.read_in_full) return "border-dashed border-scan-line bg-scan";
  return "border-scan-line bg-surface-paper";
}

export function CoverageSpine(props: {
  readonly total: number;
  readonly described: readonly SourcePage[];
  readonly shown: number;
  readonly onGo: (n: number) => void;
}) {
  const byPage = new Map(props.described.map((page) => [page.n, page]));

  return (
    <div className="shrink-0 border-t border-line-subtle bg-surface-panel px-6 py-5">
      <ol
        data-testid="coverage-spine"
        aria-label={`Package coverage — every page of ${props.total}`}
        className="flex items-end gap-1"
      >
        {Array.from({ length: props.total }, (_, i) => i + 1).map((n) => {
          const page = byPage.get(n);
          const label = describe(n, page);
          return (
            <li key={n} className="flex min-w-0 flex-1 justify-center">
              <button
                type="button"
                data-testid={`spine-cell-${n}`}
                data-read={page === undefined ? "none" : String(page.read_in_full)}
                title={label}
                aria-label={label}
                aria-current={n === props.shown ? "true" : undefined}
                onClick={() => props.onGo(n)}
                className={cx(
                  "tp-state h-10 w-full max-w-8 cursor-pointer rounded-xs border",
                  paint(page),
                  n === props.shown && "outline-2 outline-offset-1 outline-action",
                )}
              />
            </li>
          );
        })}
      </ol>
      <p className="pt-4 text-label leading-body text-ink-faint">
        One cell per page of the package the server counted. A page with no cell colour
        of its own is a page nobody read — it is still in the package.
      </p>
    </div>
  );
}
