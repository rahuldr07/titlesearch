import type { LifecycleResponse } from "@titlepipe/contract";
import { Card, cx } from "../../components/ui";

/**
 * THE FOUR TOP-LEVEL FIGURES, PRINTED VERBATIM.
 *
 * `LifecycleResponse` (`intake.ts:246`) carries `total`, `halted`, `moving` and
 * `failed` as four integers the SERVER decided. Nothing here adds, subtracts,
 * percentages or compares them, and there is no prop that would permit it:
 * INVARIANT 5 puts counts on the server, and `endpoints.ts:143-150` calls
 * browser arithmetic over a census "a count nobody can audit against the
 * pipeline".
 *
 * ══ THE SAME FOUR AS THE OVERVIEW, AND THAT IS THE POINT ═══════════════════
 *
 * `features/overview/StatCard.tsx` prints these four as four cards. This is a
 * strip rather than a copy of that component for two reasons, and only the
 * first is mechanical: `cross-feature-import` forbids reaching into
 * `features/overview` at all, and a board whose subject is seven columns should
 * not open with four objects the same size as the columns.
 *
 * The LABELS are the overview's, word for word, and deliberately so. Rule 11 —
 * "numbers reconcile across screens, one variable never two literals" — is
 * satisfied for the figures by both screens reading the same four members of
 * one response. Two different captions over one member would break it at the
 * only layer left: a reader who sees "Halted" here and "Stalled" there has two
 * facts to reconcile where the server sent one.
 *
 * ══ WHAT IS NOT DRAWN ══════════════════════════════════════════════════════
 *
 * No rate, no delta, no "since last week", no median, no bar. INVARIANT 23 and
 * AGENTS.md ban throughput and pace language anywhere, and a figure strip at
 * the top of a board is the single most likely place in this product for one to
 * arrive. `/api/metrics` is not read by this screen.
 */

/**
 * The tone is a STATIC property of the category, never a function of the
 * number. A `failed` figure that turned red only above zero would be the
 * browser deciding when a count is bad — the server's call, and nobody asked
 * it.
 */
const FIGURE_TONE = {
  primary: "text-ink-primary",
  secondary: "text-ink-secondary",
  attend: "text-state-attend",
  halt: "text-state-halt",
} as const;

type FigureTone = keyof typeof FIGURE_TONE;

const FIGURES: readonly {
  readonly member: keyof Pick<LifecycleResponse, "total" | "halted" | "moving" | "failed">;
  readonly label: string;
  readonly tone: FigureTone;
}[] = [
  { member: "total", label: "Total in the shop", tone: "primary" },
  { member: "halted", label: "Halted", tone: "attend" },
  { member: "moving", label: "Moving", tone: "secondary" },
  { member: "failed", label: "Failed", tone: "halt" },
];

export function BoardCensus(props: { readonly board: LifecycleResponse }) {
  return (
    <Card padding="none">
      <dl className="grid grid-cols-4">
        {FIGURES.map((figure) => (
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
