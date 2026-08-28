import type { BenchSection } from "@titlepipe/contract";
import { Alert, Card } from "../../components/ui";
import { BenchFail } from "./BenchFail";

/**
 * ONE SECTION'S RECORD: what it scored, what the server warns about it, and
 * every field it missed.
 *
 * ══ `suspect_note` IS A REFUSAL, NOT A FOOTNOTE ════════════════════════════
 *
 * The server's note on `judgments_liens` in this run reads: "SUSPECT — thin
 * seed (9f), 3 of 7 known defects, lowest typist accuracy. Do not optimise
 * against this without the blind fifty." That is an instruction about what the
 * numbers beside it may be used FOR, and a reader who takes the pass count
 * without it will tune the ensemble against a seed the shop already distrusts.
 * So it renders as an `attend` alert at the top of the section, above the
 * failures, in the server's words verbatim — never abbreviated, never moved to
 * a tooltip, never below the fold of its own card.
 *
 * `note` is the quieter sibling — scope rather than warning ("4 of 5 seeded —
 * location.zip is ORDER_SUPPLIED, absent from every denominator") — and gets a
 * plain paragraph. Both are `nullable` in the contract and neither is invented
 * when absent.
 *
 * ══ `passed` AND `n` STAY TWO NUMBERS ══════════════════════════════════════
 *
 * Same rule as the matrix, restated because this is the other place the
 * temptation lives: no ratio, no percentage, no "score". They are printed as
 * the server sent them.
 */
export function BenchSectionCard({ section }: { readonly section: BenchSection }) {
  return (
    <Card padding="none">
      <div className="flex items-baseline justify-between gap-8 border-b border-line-subtle bg-surface-sunken px-12 py-6">
        <span className="font-mono text-meta leading-close font-semibold text-ink-primary">
          {section.section}
        </span>
        <span className="font-mono text-label leading-flat text-ink-muted">
          <span aria-hidden>
            {section.passed} / {section.n}
          </span>
          <span className="sr-only">
            {section.passed} passed of {section.n} fields
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-6 px-12 py-8">
        {section.suspect_note !== null && (
          <Alert tone="attend" title="About this seed" message={section.suspect_note} />
        )}
        {section.note !== null && (
          <p className="text-meta leading-body text-ink-secondary">{section.note}</p>
        )}

        {section.fails.length === 0 ? (
          /*
           * The server's answer, said as an answer. "No failures" and "we could
           * not ask" must not look alike — the read's own failure is drawn by
           * `BenchReadState`, and this sentence is only ever reached with data
           * in hand.
           */
          <p className="text-meta leading-body text-ink-muted">
            Every measured field in this section matched the seed.
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {section.fails.map((fail) => (
              <li key={fail.path}>
                <BenchFail fail={fail} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
