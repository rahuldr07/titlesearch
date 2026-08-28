import { Badge, Card, CardBody, CardHeader } from "../../components/ui";
import { BackendGap } from "../../entities/gap/BackendGap";
import { MetaStrip } from "./MetaStrip";
import { PageMatrix, PageMatrixLegend } from "./PageMatrix";
import { PolicyExceptions } from "./PolicyExceptions";
import { StageTimeline } from "./StageTimeline";
import { CardTitle } from "./cardTitle";
import { useOrderPages, usePipeline } from "./useExtraction";

/**
 * SCREEN 6 — EXTRACTION. A SUB-VIEW OF `/orders/$orderId`, NOT A ROUTE.
 *
 * `ANALYSIS-screens.md` §1 row 6 places it there and the door table is why:
 * `authz.ts:66` grants `/orders` as a PREFIX and there is no extraction path
 * in the frozen list. A `/extraction` route would be a door nobody opened.
 *
 * ══ THE LAYOUT IS THE DESIGN'S ════════════════════════════════════════════
 *
 * `/tmp/ref.html` §isProcessing: heading, a hairline-divided meta bar, then a
 * two-column band — `minmax(0,1fr)` of stages and matrix beside a 340px rail —
 * on 24px gaps over the app canvas. What used to be here was one stacked column
 * of four equal cards, which read as a list rather than as a run in progress.
 *
 * ══ FOUR THINGS THE DESIGN DRAWS AND THIS SCREEN REFUSES ═══════════════════
 *
 * 1. "TIME TO EXAMINATION" and its mono ETA chip, top right. INVARIANT 23 and
 *    AGENTS.md's anti-patterns: no rates, no elapsed time, no estimates,
 *    anywhere. An estimate is also a promise the server never made.
 * 2. THE "↺ REPLAY" BUTTON beside it — a mutation with no endpoint and no
 *    permission (authz.ts:59-118). See `StageTimeline`.
 * 3. THE EYEBROW PILL above the heading ("Autonomous Dual-Engine Pipeline").
 *    The craft floor bans the pattern and commit 496ca62 removed the last two
 *    for the same reason: at 11px on `ink-faint` it measures 2.82:1, and the
 *    heading carries its own weight.
 * 4. THE STAGE CARD'S CTA FOOTER — "N exceptions securely routed to human
 *    review" beside an "Enter Examination Workstation →" button. N is a count
 *    NO RESPONSE CARRIES: `PipelineStage` (intake.ts:83) has no count member,
 *    so the sentence could only be composed here. The BUTTON half is refused
 *    for a different reason, and an earlier note here got it wrong: the
 *    workstation IS built (`/orders/$orderId/review`, orderRoutes.tsx:63) and
 *    `VerdictCard` (hub/VerdictCard.tsx:70) already carries the one accented
 *    way in, from the hub rendered directly above this view on the same
 *    scrolling route (OrderRoute:18-19). A second primary into the same door
 *    is a duplicate, not a missing action.
 *
 * ══ THE DARK TERMINAL IS REFUSED, NOT DEFERRED ═════════════════════════════
 *
 * The design's rail opens with a 320px black terminal streaming the run's log.
 * This is the one omission that is a REFUSAL rather than a gap:
 * `entities.ts:17-19` states that probes are never visible in any client
 * (CONTEXT §14) and that no schema may exist for a screen to consume. Run log
 * lines are the pipeline talking about its own attempts, which is what a probe
 * is. The `BackendGap` stands in its slot and says so in those terms.
 *
 * ══ gate_halted IS READ, NEVER INFERRED ════════════════════════════════════
 *
 * intake.ts:97 — "Server state. The screen never infers a halt from a stage
 * list." So the halt banner is driven by that boolean and not by scanning
 * `stages` for a `halted` phase; the two can legitimately differ.
 */
export function ExtractionView(props: { readonly orderId: string }) {
  const pipeline = usePipeline(props.orderId);
  const pages = useOrderPages(props.orderId);

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
            {/*
             * The design's accent-ruled callout, and the one piece of standing
             * copy on this screen. It states a product rule, not a reading of
             * any response: judgments never auto-confirm in v1 and engine
             * self-confidence never gates a confirm (AGENTS.md).
             */}
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
