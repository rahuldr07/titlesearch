import type { CompletenessGap } from "@titlepipe/contract";
import { Card, CardBody, CardHeader, Empty } from "../../components/ui";

/**
 * DETERMINISTIC CHECKS — design §Screens 4's "deterministic checks list".
 *
 * ══ WHAT THE CONTRACT CALLS THEM ═══════════════════════════════════════════
 *
 * The completeness gate: `OrderCompletenessResponse` (`intake.ts:173`) and
 * `CompletenessGap` (`intake.ts:143`). These are the checks that are actually
 * deterministic — the package measured against what the sign-off claimed — and
 * `intake.ts:139-142` says why they are the ones that matter: "THE GATE BLOCKS
 * EXTRACTION. A package that cannot support the search that was ordered
 * produces a report nobody can stand behind, and finding that out after
 * extraction costs the extraction."
 *
 * `GapKind` is a THREE-MEMBER enum — `na_provisional` | `disagreement` |
 * `period_short` — and ANALYSIS-screens §3 says to adopt the server's kinds and
 * "stop free-typing". The design's own word for this block ("checks") named no
 * taxonomy at all.
 *
 * ══ `gate_open` IS READ, NEVER DERIVED ═════════════════════════════════════
 *
 * `intake.ts:176`: "Server-owned. Never derived client-side from the gap list."
 * An empty gap array does NOT mean the gate is open — the caller may be scoped
 * out of gaps they cannot see, exactly as `LifecycleStage.count` is not
 * `orders.length`. So the banner reads `gate_open` and the list reads `gaps`,
 * and neither is inferred from the other.
 *
 * ══ THE CLOSE OPTIONS ARE SHOWN AND NOT OFFERED ════════════════════════════
 *
 * `GapCloseOption` (`intake.ts:126`) is A READ SHAPE ONLY — `intake.ts:118-120`:
 * "the server still decides which options it offers, the order it offers them
 * in, and whether any of them may be taken. NO WRITE EXISTS FOR A SINGLE ONE OF
 * THEM, and none is added here." So each option renders as a statement of what
 * could close the gap, with the server's own `consequence` sentence, and there
 * is no button. A control that posts nowhere is worse than no control.
 */
export function DeterministicChecks(props: {
  readonly gateOpen: boolean | undefined;
  readonly gaps: readonly CompletenessGap[] | undefined;
}) {
  return (
    <Card padding="none">
      <CardHeader>
        Deterministic checks — the package against the sign-off
        {props.gateOpen !== undefined && (
          <span
            data-testid="gate-state"
            data-gate-open={props.gateOpen}
            className={
              props.gateOpen
                ? "rounded-pill border border-state-settled-border bg-state-settled-surface px-5 py-1 text-label font-semibold leading-flat text-state-settled"
                : "rounded-pill border border-state-halt-border bg-state-halt-surface px-5 py-1 text-label font-semibold leading-flat text-state-halt"
            }
          >
            {props.gateOpen ? "Gate open" : "Gate closed"}
          </span>
        )}
      </CardHeader>

      {props.gaps === undefined ? (
        <CardBody>
          <p className="text-meta leading-body text-ink-muted">
            The server has not answered for this order's gate.
          </p>
        </CardBody>
      ) : props.gaps.length === 0 ? (
        <Empty
          title="No gaps raised"
          reason="The gate raised nothing against this package. That is the server's list, not a filter — a gap you cannot see is a gap that is not on it."
        />
      ) : (
        <ul>
          {props.gaps.map((gap) => (
            <li
              key={gap.id}
              data-gap={gap.id}
              data-gap-kind={gap.kind}
              className="flex flex-col gap-5 border-b border-line-subtle px-12 py-9 last:border-b-0"
            >
              <div className="flex items-baseline gap-5">
                <span
                  aria-hidden
                  className="font-mono text-body leading-flat text-state-attend"
                >
                  ◆
                </span>
                {/* `line_number` is a READ FIELD the server supplies precisely
                    so the reader can get back to the line they answered —
                    matching on prose would be a join the browser must not make
                    (`intake.ts:151-158`). */}
                <span className="font-mono text-label leading-flat tabular-nums text-ink-muted">
                  Line {gap.line_number}
                </span>
                <span className="text-meta font-semibold leading-close text-ink-primary">
                  {gap.line_label}
                </span>
                <span className="ml-auto font-mono text-label leading-flat text-ink-faint">
                  {gap.kind}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-12 gap-y-3">
                <Side term="The sign-off claimed" body={gap.claim} />
                <Side term="The package shows" body={gap.evidence} />
              </dl>

              {gap.closed_by === null ? (
                <div className="flex flex-col gap-3">
                  <span className="text-label font-bold leading-flat text-ink-faint">
                    What the server says could close it
                  </span>
                  {gap.close_options.map((option) => (
                    <p
                      key={option.kind}
                      className="text-meta leading-body text-ink-secondary"
                    >
                      <span className="font-semibold text-ink-primary">
                        {option.label}
                      </span>{" "}
                      — {option.consequence}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-meta leading-body text-ink-secondary">
                  Closed by {gap.closed_by}
                  {gap.closed_note === null ? "" : ` — ${gap.closed_note}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Side(props: { readonly term: string; readonly body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-label font-bold leading-flat text-ink-faint">
        {props.term}
      </dt>
      <dd className="text-meta leading-body text-ink-primary">{props.body}</dd>
    </div>
  );
}
