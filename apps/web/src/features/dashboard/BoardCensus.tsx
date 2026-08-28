import type { LifecycleResponse } from "@titlepipe/contract";
import { Card, cx } from "../../components/ui";
import { CENSUS_FIGURES } from "../../entities/lifecycle/census";

/**

 * The four top-level figures, printed verbatim. `LifecycleResponse` (`intake.ts:246`)

 * carries `total`, `halted`, `moving` and `failed` as four integers the SERVER

 * decided.

 */

/**

 * The tone is a STATIC property of the category, never a function of the number. A

 * `failed` figure that turned red only above zero would be the browser deciding when a

 * count is bad — the server's call, and nobody asked it.

 */
const FIGURE_TONE = {
  primary: "text-ink-primary",
  secondary: "text-ink-secondary",
  attend: "text-state-attend",
  halt: "text-state-halt",
} as const;

export function BoardCensus(props: { readonly board: LifecycleResponse }) {
  return (
    <Card padding="none">
      <dl className="grid grid-cols-4">
        {CENSUS_FIGURES.map((figure) => (
          <div
            key={figure.member}
            data-census={figure.member}
            className="flex flex-col gap-2 border-r border-line-subtle px-12 py-10 last:border-r-0"
          >
            {/* Rule 4: sentence case. Rule 2: 11px, one of the six sizes. */}
            <dt className="font-sans text-label leading-flat font-semibold text-ink-muted">
              {figure.label}
            </dt>
            {/*
             * `tabular-nums` so four figures in a row line up on one column.
             * NOT `font-mono`: rule 3's list of what mono is for is closed and
             * enumerated — refs, money, citations, hashes, timestamps, kbd — and
             * a census count is not on it.
             */}
            <dd
              data-census-value={props.board[figure.member]}
              className={cx(
                "font-sans text-title leading-flat font-bold tabular-nums",
                FIGURE_TONE[figure.tone],
              )}
            >
              {props.board[figure.member]}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
