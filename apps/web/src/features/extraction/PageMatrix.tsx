import { useNavigate } from "@tanstack/react-router";
import type { SourcePage } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * THE PAGE MATRIX (design §Screens 6: "page matrix — one cell per page, click
 * → workstation at that page; cream extracted / muted-red degraded").
 *
 * ══ THE TWO PAINTS ARE THE SERVER'S FINDING, NOT AN INFERENCE ══════════════
 *
 * `SourcePage.degraded` is documented at endpoints.ts:648 as "Scan quality
 * finding. Drives the degraded render; never inferred client-side." So the
 * cell reads that boolean and nothing else. It does NOT infer degradation from
 * an empty `lines` array, from `read_in_full`, or from a short page — a page
 * with no lines the report needs is normal (endpoints.ts:640), and conflating
 * "nothing on it" with "could not read it" is the same collapse
 * `NOT_PRESENT` / `PRESENT_UNREADABLE` exists to prevent.
 *
 * `read_in_full` is a THIRD fact and is drawn as weight rather than as a third
 * colour: rule 6 allows one status signal per row, and a page that was not
 * read in full is normal rather than a state to alarm about.
 *
 * ══ THE CLICK TARGET IS THE FROZEN DOOR, WITH A PARAM ══════════════════════
 *
 * INVARIANT 55: deep links land on the exact thing in context, and selection
 * is URL-owned. The route is `/orders/$orderId` (authz.ts:66 covers the
 * prefix) and `page` rides in the search string beside `field`.
 */
export function PageMatrix(props: {
  readonly orderId: string;
  readonly pages: readonly SourcePage[];
}) {
  const navigate = useNavigate();

  if (props.pages.length === 0) {
    return (
      <p
        data-testid="page-matrix-empty"
        className="font-sans text-meta leading-body text-ink-faint"
      >
        The server served no page rows for this order. That is not a page count
        of zero — it is the absence of a page list.
      </p>
    );
  }

  return (
    <ul data-testid="page-matrix" className="flex flex-wrap gap-3">
      {props.pages.map((page) => (
        <li key={page.n}>
          <button
            type="button"
            data-testid={`page-cell-${page.n}`}
            data-degraded={page.degraded ? "true" : undefined}
            title={`${page.kind} — page ${page.n}`}
            onClick={() =>
              void navigate({
                to: "/orders/$orderId",
                params: { orderId: props.orderId },
                search: { page: page.n },
              })
            }
            className={cx(
              "tp-state tp-ring flex h-15 w-13 cursor-pointer items-center justify-center",
              "rounded-xs border font-mono text-label leading-flat tabular-nums",
              page.degraded
                ? "border-state-halt-border bg-state-halt-surface text-state-halt"
                : "border-scan-line bg-scan text-scan-ink",
              page.read_in_full ? "font-bold" : "font-normal",
            )}
          >
            {page.n}
          </button>
        </li>
      ))}
    </ul>
  );
}
