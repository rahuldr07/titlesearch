import type { SourcePage } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * INVARIANT 34: "The coverage spine renders ONE CELL PER PACKAGE PAGE, not just
 * read ones."
 *
 * ══ WCAG 2.2 §2.5.8 — 64 CELLS UNDER 24px, AND WHY THAT IS THE EXCEPTION ═══
 *
 * axe reports one `target-size` violation per cell — 64 of them, measured at
 * 6.7 x 20px each. That is not sloppiness and it is not fixable by widening:
 *
 *   - **Essential.** INVARIANT 34 requires one cell per package page, and
 *     PRODUCT.md puts a real package at 36-181 pages. At 181 cells of 24px the
 *     spine is 4,344px wide, which is not a spine and not a screen. The
 *     presentation is essential to the requirement, which §2.5.8 exempts.
 *   - **Equivalent.** §2.5.8 also exempts an undersized target when another
 *     control on the same page achieves the same function and meets the
 *     criterion. `PageBar`'s Prev and Next do exactly that, and they pass:
 *     measured 62x30 and 64x30 in the running app.
 *
 * So the cells stay, and this is a KNOWN, JUSTIFIED axe finding rather than a
 * clean sweep. Every cell also carries a `title` and an `aria-label` naming its
 * page and what happened to it, so the information the spine encodes in colour
 * is reachable without hitting a 6px target at all.
 *
 * The denominator is `total_pages`. It is never `pages.length`, and the live
 * fixture is built to make that failure loud: `total_pages` is 64 and the array
 * holds 7. A spine driven off the array would draw seven cells and quietly
 * claim the package is seven pages long — which is not a cosmetic bug, it is
 * the screen telling a reviewer the search covered the whole package when
 * fifty-seven pages of it were never read by anybody.
 *
 * `demoPages`' own comment says the fixture exists for this: "a fixture that
 * only ever contained cited, fully-read pages could not exercise 'present but
 * not fully read' as distinct from 'absent from the array entirely' — the
 * spine's whole reason for existing is telling those two apart."
 *
 * ══ FOUR CELLS, THREE FACTS, ONE SIGNAL EACH (rule 6) ══════════════════════
 *
 *   no entry in `pages[]`  sunken, hairline   nobody read this page
 *   entry, not read in full warm, dashed edge  read, but not in full
 *   entry, read in full     warm, solid edge   read
 *   entry, `degraded`       the halt family    the scan is degraded
 *
 * Every one of those is the server's word. `degraded` in particular is
 * "never inferred client-side" (endpoints.ts:678), so no cell reads an empty
 * `lines[]` or a false `read_in_full` and concludes the scan was bad — that
 * conflation is the same one `NOT_PRESENT` / `PRESENT_UNREADABLE` exists to
 * prevent (INVARIANT 7).
 *
 * The cell has no text: at ~9px wide in a 64-page package it could not carry
 * any. Its `title` and its accessible name carry the whole sentence, which is
 * also how the reference app does it (`p.title` on every span).
 */
function describe(n: number, page: SourcePage | undefined): string {
  if (page === undefined) return `Page ${n} — no reader read this page`;
  if (page.degraded) return `Page ${n} — ${page.kind} · the server marked this scan degraded`;
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
        One cell per page of the package the server counted. A page with no
        cell colour of its own is a page nobody read — it is still in the
        package.
      </p>
    </div>
  );
}
