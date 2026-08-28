import type { Reconciliation } from "@titlepipe/contract";
import { Card, CardBody, CardHeader, Empty, cx } from "../../components/ui";

/**
 * THE DIVERGENCES ON ONE ORDER, IN THE SERVER'S ORDER.
 *
 * No sort, no filter, no priority. `Reconciliation` (entities.ts:202-213)
 * carries a path, the two seats' values and the ruling triple — and nothing to
 * sort BY. The same reasoning `INVARIANTS:39` states for the escalation inbox
 * holds: a triage control is a field, and there is no field.
 *
 * Nothing is counted. `INVARIANTS:5` — the UI never re-derives counts — and
 * `INVARIANTS:23`/`26` keep pace language off every screen, so there is no "3
 * open" header here even though three rows are visibly on the page. The rows
 * are the answer; a number beside them would be a second, unciteable one.
 *
 * ══ RULED IS `ruled_by`, NOT `ruling_value` ════════════════════════════════
 *
 * `ruling_value` is NULLABLE and null is a RULING — "neither reading is right"
 * (endpoints.ts:351, rule 14). Reading the state off it would draw a
 * deliberately-null ruling as unruled and invite a second one. The server's
 * `ruled_by` is the record that a senior acted; handlers.ts:1299 checks both,
 * and this reads the one that cannot be confused with a value.
 *
 * Rule 6: one status signal per row — the ◆ mark plus weight. No capsule.
 */
export function DivergenceList({
  divergences,
  selectedId,
  onSelect,
}: {
  readonly divergences: readonly Reconciliation[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <Card padding="none">
      <CardHeader>Where the two seats disagree</CardHeader>
      <CardBody className="flex flex-col gap-0 p-0">
        {divergences.length === 0 ? (
          <Empty
            title="No divergences on this order"
            reason="The two blind seats typed the same thing everywhere they were both asked. That is a finding, not an empty read."
          />
        ) : (
          divergences.map((divergence) => {
            const ruled = divergence.ruled_by !== null;
            const selected = divergence.id === selectedId;
            return (
              <button
                key={divergence.id}
                type="button"
                data-testid={`divergence-${divergence.id}`}
                data-path={divergence.path}
                data-ruled={ruled}
                aria-current={selected}
                onClick={() => onSelect(divergence.id)}
                className={cx(
                  "tp-state flex cursor-pointer flex-col gap-3 border-b border-line-subtle px-10 py-8 text-left",
                  "last:border-b-0 hover:bg-row-hover",
                  selected && "bg-surface-sunken",
                )}
              >
                {/* Rule 3: a field path is an identifier, so it is mono. */}
                <span className="font-mono text-label leading-flat text-ink-muted">
                  {divergence.path}
                </span>
                <span
                  className={cx(
                    "font-sans text-meta leading-close text-ink-primary",
                    !ruled && "font-semibold",
                  )}
                >
                  <span aria-hidden className="pr-3 text-ink-muted">
                    {ruled ? "" : "◆"}
                  </span>
                  {ruled ? `Ruled by ${divergence.ruled_by ?? ""}` : "Open — awaiting a ruling"}
                </span>
              </button>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
