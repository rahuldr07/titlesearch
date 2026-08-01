import type { ReactNode } from "react";
import type { Field } from "@titlepipe/contract";
import { enginesDisagree, readingsOf } from "./fieldLabel";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * RULE: `--text-4xl` is annotated "the decision question, the as-read value" —
 * the mockup draws both at 26px, so the question and its answer are what the
 * eye lands on. FAILURE PREVENTED: at `text-md` the reading was 12.5px, the
 * size of the field's own path label, so the string being confirmed was the
 * least prominent text on the surface built to confirm it. Leading is flat
 * because the mockup's band is 50px; at the inherited 1.45 it opens to 65px.
 */
const VALUE = "font-mono text-4xl leading-flat font-semibold text-ink-primary";

/**
 * THE READING, SHOWN ONCE.
 *
 * The export draws one sunken `As read` row and no per-engine cards at all —
 * "READER A" and "use this reading" are not in its 3,779 lines. The build drew
 * a bordered card per engine with its own adopt button, which roughly doubled
 * the decision pane and put the ensemble in front of the question. The owner
 * ruled for the export's row (D4): the reviewer's job is the question, not the
 * ensemble, so the detail folds and the answer leads.
 *
 * PRINCIPLE 6 SURVIVES THE FOLD, and that is the constraint the fold had to be
 * built around: the CITE and the FACT THAT MORE THAN ONE ENGINE WAS CONSULTED
 * are outside the disclosure, always readable. A value whose page has to be
 * uncovered by a click is a value that ships uncited, because nobody clicks.
 * What folds is only WHICH engine returned WHAT — detail a reviewer needs when
 * they doubt the answer, not to read it.
 *
 * THE FOLD OPENS ITSELF ON A DISAGREEMENT. A settled reading has a resting
 * state; a disagreement does not — it IS the question, and folding away the two
 * candidate strings would hide the reason the field is on the queue at all.
 * `open` is therefore the disagreement, not a preference, which is also why it
 * is not remembered anywhere.
 *
 * A MISSING CITE IS AN ERROR WITH A VOICE, never a quiet gap: a sheet that
 * renders unciteable values indistinguishably from citeable ones is how one
 * reaches a client.
 */
export function AsRead({
  field,
  children,
}: {
  field: Field;
  /** The per-engine detail. Folded, and self-opening on a disagreement. */
  children: ReactNode;
}) {
  const readings = readingsOf(field);
  const disagree = enginesDisagree(field);
  // A both-found disagreement never claims emptiness (`ux.spec` #1): the
  // leading reading stands in AS A DRAFT, labelled. "Not Available" here would
  // tell the reviewer there is nothing to look at while two candidates sit in
  // the payload.
  const draft = readings.find((reading) => reading.value !== null)?.value ?? null;
  const page = field.source_page ?? readings.find((r) => r.page !== null)?.page ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-5 rounded-7 border border-line-strong bg-surface-sunken px-6 py-5.5">
        {/* Literal capitals: a CSS transform does not change what the text says. */}
        <Eyebrow variant="caption">AS READ</Eyebrow>

        {field.value !== null ? (
          <span className={VALUE}>{field.value}</span>
        ) : draft !== null ? (
          <span className="flex flex-wrap items-baseline gap-3">
            <span className={VALUE}>{draft}</span>
            <span className="text-xs text-state-attend-ink">draft — nothing settled yet</span>
          </span>
        ) : (
          <span className="text-base text-ink-secondary">Nothing has been merged for this field.</span>
        )}

        {/* A missing cite is only a claim worth making about something that was
            READ. On a field the pipeline has not reached there is nothing to
            cite yet, and shouting "no page cited" at an absence would raise an
            alarm about work nobody has done. */}
        {page === null ? (
          field.value === null && draft === null ? null : (
            <span data-testid="as-read-cite" className="ml-auto text-tiny font-semibold text-state-halt-ink">
              no page cited
            </span>
          )
        ) : (
          /* RULE: every page reference is the same bordered page-ref chip, so a
             cite is one recognisable object wherever it appears. FAILURE
             PREVENTED: bare coloured text read as the value's suffix, not as its
             provenance — principle 6 turns on those being separate claims. Not
             `PageChip`: that is a button, and this cite navigates nowhere. */
          <span
            data-testid="as-read-cite"
            className="ml-auto rounded-3 border border-page-ref-border bg-page-ref-surface px-3 py-1 font-mono text-micro font-semibold text-page-ref"
          >
            p{page}
          </span>
        )}
      </div>

      {field.source_snippet === null ? null : (
        <p className="font-quote text-xs italic text-ink-secondary">{field.source_snippet}</p>
      )}

      {readings.length === 0 ? (
        // No pre-merge readings on the wire. `engine_id` is then the only
        // attribution there is, and it still has to appear: a value whose
        // reader is unnamed is a value nobody can go back and check. Silent
        // where nothing was read at all — there is no reader to name yet.
        field.value === null && draft === null ? null : (
          <p className="text-xs text-ink-muted">
            {field.engine_id === null ? (
              <span className="font-semibold text-state-halt-ink">
                No reading recorded — nothing attributes this value to a reader.
              </span>
            ) : (
              <>
                Read by <span className="font-mono">{field.engine_id}</span>
              </>
            )}
          </p>
        )
      ) : (
        <details open={disagree} data-testid="readings-disclosure">
          <summary className="cursor-pointer text-xs text-ink-muted">
            {/* The count is the length of the `readings` array the server sent — a
                description of the payload rendered, not a re-derivation of any
                count the server publishes. It stays outside the fold: "one engine
                read this" and "two read it and split" are different claims. */}
            <span className="font-semibold text-ink-secondary">
              Read by {readings.length}
              {readings.length === 1 ? " engine" : " engines"}
            </span>
            {" — "}
            {disagree ? (
              <span className="font-semibold text-state-attend-ink">
                THEY DISAGREE. THAT IS WHY IT IS YOURS.
              </span>
            ) : (
              <span>same value from each. Show what each returned</span>
            )}
          </summary>
          <div className="mt-4 flex flex-col gap-4">{children}</div>
        </details>
      )}
    </div>
  );
}
