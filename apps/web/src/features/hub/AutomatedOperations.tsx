import type { PipelineStage } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";

/**
 * AUTOMATED-OPERATIONS ROWS — design §Screens 4, verbatim: "Automated-
 * operations rows (COUNT STRINGS DERIVE FROM ORDER DATASET)."
 *
 * ══ THE PARENTHESIS IS THE PART THAT IS REFUSED ════════════════════════════
 *
 * "Count strings derive from order dataset" makes the client the arithmetic
 * authority, and ANALYSIS-screens §5 item 3 names it as one of three explicit
 * statements doing so. `PipelineStage` (`intake.ts:83`) carries `detail`, a
 * SERVER-COMPOSED sentence with the count already in it — "Deskew, de-speckle,
 * OCR · 41 pages" — for the same reason `LifecycleStamp.label` is served: a
 * client-side template that interpolates a number into product copy is a second
 * copy of that copy, and it drifts silently from the first.
 *
 * So every row here prints two server strings and one server enum, and there is
 * no `${}` anywhere in the file. Nothing is counted, nothing is joined, nothing
 * is pluralised.
 *
 * ══ `owner` IS THE ROW'S SUBJECT, AND IT IS A THREE-MEMBER ENUM ════════════
 *
 * `StageOwner` (`intake.ts:80`) is `Automated` | `LLM agent` | `You` — the
 * shop's own division of labour. The design calls the whole block "automated
 * operations", which is true of most rows and false of the two the pipeline
 * stops on for a person. Printing the owner is what keeps a halted human stage
 * from reading as a machine that failed.
 *
 * ══ `phase` DRIVES THE MARK, AND NOTHING INFERS IT ═════════════════════════
 *
 * `StagePhase` is `done` | `running` | `halted` | `waiting`. This component
 * does NOT infer "the next one must be running because the last is done", and
 * does not infer done from a count reaching a total — a stage that processed
 * every page and then failed to write its output is complete by arithmetic and
 * failed in fact, and only the server knows which. Rule 6: one status signal
 * per row, a mark plus weight, no capsule.
 */
export function AutomatedOperations(props: {
  readonly stages: readonly PipelineStage[] | undefined;
  readonly classifierNote: string | undefined;
  readonly gateHalted: boolean | undefined;
}) {
  return (
    <Card padding="none">
      <CardHeader>
        Automated operations
        {props.gateHalted === true && (
          // SERVER STATE (`intake.ts:99`: "Server state. The screen never infers
          // a halt from a stage list.").
          <span
            data-testid="gate-halted"
            className="rounded-pill border border-state-halt-border bg-state-halt-surface px-5 py-1 text-label font-semibold leading-flat text-state-halt"
          >
            Gate halted
          </span>
        )}
      </CardHeader>

      {props.stages === undefined ? (
        <CardBody>
          <p className="text-meta leading-body text-ink-muted">
            The server has not described this order's run.
          </p>
        </CardBody>
      ) : (
        <ol>
          {props.stages.map((stage) => (
            <li
              key={stage.id}
              data-stage={stage.id}
              data-phase={stage.phase}
              className="flex items-baseline gap-6 border-b border-line-subtle px-12 py-7 last:border-b-0"
            >
              <span
                aria-hidden
                className={`w-6 shrink-0 font-mono text-body leading-flat ${MARK[stage.phase].ink}`}
              >
                {MARK[stage.phase].glyph}
              </span>
              <span className="sr-only">{stage.phase}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-meta font-semibold leading-close text-ink-primary">
                  {stage.label}
                </span>
                {/* The server's sentence, with its own count already in it. */}
                <span className="text-meta leading-body text-ink-secondary">
                  {stage.detail}
                </span>
              </div>
              <span className="shrink-0 text-label leading-flat text-ink-faint">
                {stage.owner}
              </span>
            </li>
          ))}
        </ol>
      )}

      {props.classifierNote !== undefined && (
        <CardBody className="border-t border-line-subtle py-8">
          <p className="text-meta leading-body text-ink-secondary">
            {props.classifierNote}
          </p>
        </CardBody>
      )}
    </Card>
  );
}

/** Rule 7's closed glyph vocabulary — ✓ ◆ • and nothing else. No icons. */
const MARK = {
  done: { glyph: "✓", ink: "text-state-settled" },
  running: { glyph: "•", ink: "text-action animate-tp-pulse" },
  halted: { glyph: "◆", ink: "text-state-halt" },
  waiting: { glyph: "•", ink: "text-ink-muted" },
} as const;
