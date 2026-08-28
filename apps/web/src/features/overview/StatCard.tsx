import { Card, cx } from "../../components/ui";

/**
 * ONE STAT CARD, drawn to the prototype's geometry.
 *
 * Measured out of `reference-app.html` (the `queueStats` block and the `<sc-for>`
 * that renders it) rather than paraphrased out of the README, which is how the
 * previous version came to say "Every order the book knows about":
 *
 *     padding 18px · radius 14 · white · 1px #E4E7ED · card shadow
 *     label  11px w600 #8A8E98              ← NOT uppercase, NOT tracked
 *     value  28px w700 ls -.02em, mt 6px    ← NOT mono
 *     note   13px, mt 4px
 *
 * Two of those were wrong here and both were rule violations, not preferences.
 * The label was `uppercase tracking-caps`: rule 4 permits ALL-CAPS in exactly
 * two places, "sidebar rubrics and serif certificate headings", and a stat card
 * is neither. The value was `font-mono` under a comment asserting "a count is
 * data, so it is mono" — rule 3's list of what mono is for is closed and
 * enumerated ("order refs, money, citations, hashes, timestamps, kbd"), a count
 * is not on it, and the prototype sets the figure in the sans display face.
 *
 * ══ THERE IS NO NOTE LINE, AND THAT IS THE POINT ═══════════════════════════
 *
 * The prototype's third line is authored copy — "Open work, sorted by
 * deadline", "Signed and sealed by an examiner" — written against ITS four
 * figures, which are not ours (`CONFLICT-overview-stats.md`). The contract
 * authors no note for `total`/`halted`/`moving`/`failed`: `LifecycleResponse`
 * carries the four integers and ONE sentence, `scope_note`, which the screen
 * prints verbatim in the header where it belongs.
 *
 * So there is nowhere to get a per-card note from, and the previous version's
 * four sentences were composed here. AGENTS.md's "never emit a value you can't
 * cite" is not only about numbers — a sentence asserting what a figure means is
 * a claim about the pipeline, and the pipeline did not make it. A card that is
 * one line shorter than the prototype's is the honest render; four invented
 * sentences that read as product copy are not.
 *
 * ══ `value` IS OPTIONAL, AND ABSENT IS NOT ZERO ════════════════════════════
 *
 * The same rule `OrderFieldsResponse.census` states on the wire
 * (`endpoints.ts:163-167`): "OPTIONAL, and absent is not zero — it is 'the
 * server did not say'." On a screen whose subject is how much work is
 * outstanding, a `0` nobody sent is the most expensive possible wrong answer.
 *
 * There is NO arithmetic here and no prop that would permit any. A percentage,
 * a delta, a "since last week" or a rate would each be the browser deciding
 * something (hard rule 3), and §4.5 means the rate never may exist at all.
 */

/**
 * The prototype colours the figure per card — graphite for the two neutral
 * censuses, `#8A5B12` for the one that wants attention, `#2E6B4F` for the one
 * that is a moment of record. `tone` is that channel, and it is a STATIC
 * property of the category rather than a function of the number: a `failed`
 * card that turned red only above zero would be the browser deciding when a
 * figure is bad, which is the server's call and nobody asked it.
 */
const FIGURE_TONE = {
  primary: "text-ink-primary",
  secondary: "text-ink-secondary",
  attend: "text-state-attend",
  halt: "text-state-halt",
} as const;

type StatTone = keyof typeof FIGURE_TONE;

export function StatCard(props: {
  readonly label: string;
  /** SERVER-COUNTED. Undefined means the server has not answered yet. */
  readonly value: number | undefined;
  readonly tone: StatTone;
}) {
  return (
    <Card padding="tight">
      <div className="flex flex-col gap-3">
        {/* Rule 4: sentence case. 11px w600 grey, as the prototype draws it. */}
        <span className="text-label font-semibold leading-flat text-ink-faint">
          {props.label}
        </span>
        {props.value === undefined ? (
          <span
            data-stat-unanswered
            className="text-meta leading-close text-ink-faint"
          >
            The server has not said.
          </span>
        ) : (
          /*
           * `tabular-nums` so four cards in a row line their figures up on one
           * column. The unit noun is the prototype's ("6 orders", not "6") and
           * is a fact about the figure rather than a claim about it — every one
           * of these four counts orders. Pluralised, because the prototype
           * prints "1 orders" and shipping its grammar bug is not fidelity.
           */
          <span
            data-stat-value={props.value}
            className={cx(
              "text-title font-bold leading-flat tabular-nums",
              FIGURE_TONE[props.tone],
            )}
          >
            {props.value} {props.value === 1 ? "order" : "orders"}
          </span>
        )}
      </div>
    </Card>
  );
}
