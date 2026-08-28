import type { GoldenField } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";

/**
 * WHAT THE CORPUS HOLDS NOW — read-only, and shown before anything is typed.
 *
 * A correction is an OVERWRITE of the ruler, and `handlers.ts:1345-1351` shows
 * what it does: the current value moves to `corrected_from`, the tag becomes
 * `ruled`, the citation is replaced, and the signer and timestamp are stamped
 * fresh. If the row was already corrected once, the previous correction's
 * citation and reason are the thing being displaced. Filing that blind is how a
 * signed ruling gets quietly replaced by somebody who never saw it.
 *
 * So this pane exists to be read, not edited. Nothing here is an input and
 * nothing here is derived: every line is a member of the server's row.
 *
 * ══ THE UNCITED CASE IS A HARD ERROR HERE TOO ══════════════════════════════
 *
 * `INVARIANTS:8` / AGENTS.md principle 6. A seed with a value and no citation
 * is the failure the architecture exists to catch, and this is the screen where
 * a reader is deciding whether to trust it. Printed as a bare figure it reads
 * as ground truth; printed as a defect it reads as the reason they are here.
 *
 * The four-state absence taxonomy cannot be rendered — `GoldenField`
 * (entities.ts:188) carries no `na_reason` — and the gap is stated once on the
 * screen rather than guessed at per row. A null prints as the one fact this
 * shape knows.
 */
export function CurrentSeed(props: { readonly seed: GoldenField }) {
  return (
    <Card padding="none">
      <CardHeader>What the corpus holds now</CardHeader>
      <CardBody className="flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline gap-6">
          {/* Rule 3: identifiers, spelt exactly as the rulebook spells them. */}
          <span className="font-mono text-meta leading-close font-semibold text-ink-secondary">
            {props.seed.path}
          </span>
          <span className="font-mono text-label leading-flat text-ink-faint">
            {props.seed.order_id}
          </span>
          <span className="font-sans text-label leading-flat text-ink-muted">
            tagged {props.seed.tag}
          </span>
        </div>

        {props.seed.value === null ? (
          <span className="font-sans text-body leading-close font-semibold text-ink-secondary">
            No value in the corpus
          </span>
        ) : (
          <span className="font-mono text-body leading-close font-semibold break-words text-ink-primary">
            {props.seed.value}
          </span>
        )}

        {props.seed.source_citation === null ? (
          <p
            role="alert"
            className="font-sans text-meta leading-body font-semibold text-state-halt"
          >
            Uncited. Nothing in the corpus traces this row to a document — never
            emit a value you can&rsquo;t cite (AGENTS.md, principle 6).
          </p>
        ) : (
          <p className="font-mono text-meta leading-body break-words text-ink-muted">
            {props.seed.source_citation}
          </p>
        )}

        {props.seed.corrected_at !== null && (
          <div className="flex flex-col gap-3 border-t border-line-faint pt-6">
            <span className="font-sans text-label leading-flat font-bold text-state-attend">
              Already corrected once — filing again displaces this record
            </span>
            <p className="font-sans text-meta leading-body text-ink-secondary">
              Signed{" "}
              <span className="font-mono">
                {props.seed.corrected_by ?? "an unnamed actor"}
              </span>{" "}
              at <span className="font-mono">{props.seed.corrected_at}</span>
              {props.seed.corrected_from !== null && (
                <>
                  {" · was "}
                  <span className="font-mono">{props.seed.corrected_from}</span>
                </>
              )}
            </p>
            {props.seed.correction_reason !== null && (
              <p className="font-sans text-meta leading-body text-ink-primary">
                {props.seed.correction_reason}
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
