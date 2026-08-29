import { Badge, Card, CardBody, CardHeader } from "../../components/ui";
import { BackendGap } from "../../entities/gap/BackendGap";
import { useRead } from "../../app/useRead";
import { orderPages, orderPipeline } from "../../shared/queries";
import { MetaStrip } from "./MetaStrip";
import { PageMatrix, PageMatrixLegend } from "./PageMatrix";
import { PolicyExceptions } from "./PolicyExceptions";
import { StageTimeline } from "./StageTimeline";
import { CardTitle } from "./cardTitle";

/**
 * SCREEN 6 — EXTRACTION. A SUB-VIEW OF `/orders/$orderId`, NOT A ROUTE:
 * `authz.ts:66` grants `/orders` as a PREFIX and the frozen door list holds no
 * extraction path, so a `/extraction` route would be a door nobody opened.
 *
 * `gate_halted` is READ (intake.ts:97). The halt badge never scans `stages` for
 * a halted phase — the two can legitimately differ.
 *
 * FOUR THINGS THE DESIGN DRAWS AND THIS SCREEN REFUSES:
 *
 * 1. "Time to examination" and its ETA chip — INVARIANT 23 bans rates, elapsed
 *    time and estimates outright, and an estimate is a promise the server never
 *    made.
 * 2. The "↺ Replay" button — a mutation with no endpoint and no permission
 *    (authz.ts:59-118). See `StageTimeline`.
 * 3. The eyebrow pill above the heading. At 11px on `ink-faint` it measures
 *    2.82:1; commit 496ca62 removed the last two for the same reason.
 * 4. The stage card's CTA footer, "N exceptions securely routed to human
 *    review" beside an "Enter Examination Workstation →" button. N is a count no
 *    response carries — `PipelineStage` (intake.ts:83) has no count member. The
 *    button is a duplicate: `VerdictCard` already carries the one accented way
 *    into `/orders/$orderId/review`, from the hub rendered directly above this
 *    view on the same scrolling route.
 */
export function ExtractionView(props: { readonly orderId: string }) {
  const pipeline = useRead(orderPipeline(props.orderId));
  const pages = useRead(orderPages(props.orderId));

  if (pipeline.data === undefined) {
    return (
      <p
        data-testid="extraction-unread"
        className="p-14 font-sans text-meta leading-body text-ink-faint"
      >
        {pipeline.isError
          ? "The pipeline could not be read for this order."
          : "Reading the pipeline…"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-12 bg-surface-app p-14" data-testid="extraction">
      <h2 className="font-sans text-title font-bold leading-flat text-ink-primary">
        Extraction &amp; provenance telemetry
      </h2>

      {/* Rule 6: a coloured capsule at a moment of record. A halt is one. */}
      {pipeline.data.gate_halted && (
        <Badge tone="halt">◆ The gate has halted this order</Badge>
      )}

      <MetaStrip pipeline={pipeline.data} />

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-12">
        <div className="flex min-w-0 flex-col gap-12">
          <Card>
            <CardTitle>Sequential extraction stages</CardTitle>
            <StageTimeline stages={pipeline.data.stages} />
            {/* Standing copy, and a product rule rather than a reading of any
                response: judgments never auto-confirm in v1 and engine
                self-confidence never gates a confirm (AGENTS.md). */}
            <p className="mt-12 rounded-r-lg border-l-4 border-action bg-action-surface p-8 font-sans text-meta font-medium leading-body text-ink-secondary">
              Engine confidence is recorded for telemetry and is never used to
              bypass a human read. Every conflict is confirmed by an examiner,
              and no escalation is resolved without a rule.
            </p>
          </Card>

          <Card>
            <CardTitle right={<PageMatrixLegend />}>Scan coverage matrix</CardTitle>
            {pages.data === undefined ? (
              <p className="font-sans text-meta leading-body text-ink-faint">
                {pages.isError
                  ? "The page list could not be read."
                  : "Reading the page list…"}
              </p>
            ) : (
              <PageMatrix
                orderId={props.orderId}
                total={pages.data.total_pages}
                pages={pages.data.pages}
              />
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-12">
          <BackendGap
            object="Run log terminal"
            conversation="entities.ts:17-19 · CONTEXT §14"
          >
            The design streams the run&apos;s log lines into a dark terminal.
            This is a refusal rather than a missing shape: probes are never
            visible in any client, and the contract deliberately holds no schema
            a screen could consume. Run output is the pipeline describing its
            own attempts, which is what that rule names.
          </BackendGap>

          <Card padding="none">
            <CardHeader>Policy exceptions</CardHeader>
            <CardBody>
              <PolicyExceptions orderId={props.orderId} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
