import { Badge, Card, CardBody, CardHeader } from "../../components/ui";
import { BackendGap } from "../../entities/gap/BackendGap";
import { MetaStrip } from "./MetaStrip";
import { PageMatrix } from "./PageMatrix";
import { PolicyExceptions } from "./PolicyExceptions";
import { StageTimeline } from "./StageTimeline";
import { useOrderPages, usePipeline } from "./useExtraction";

/**
 * SCREEN 6 — EXTRACTION. A SUB-VIEW OF `/orders/$orderId`, NOT A ROUTE.
 *
 * `ANALYSIS-screens.md` §1 row 6 places it there and the door table is why:
 * `authz.ts:66` grants `/orders` as a PREFIX and there is no extraction path
 * in the frozen list. A `/extraction` route would be a door nobody opened.
 *
 * ══ THE DARK TERMINAL IS REFUSED, NOT DEFERRED ═════════════════════════════
 *
 * §Screens 6 draws a "dark terminal (streams log lines with the run)". This is
 * the one omission on this screen that is a REFUSAL rather than a gap:
 * `entities.ts:17-19` states that probes are never visible in any client
 * (CONTEXT §14) and that no schema may exist for a screen to consume. Run log
 * lines are the pipeline talking about its own attempts, which is what a probe
 * is. There is nothing to ask the backend owner for here; the answer is
 * already no, and the `BackendGap` below says so in those terms.
 *
 * ══ gate_halted IS READ, NEVER INFERRED ════════════════════════════════════
 *
 * intake.ts:97 — "Server state. The screen never infers a halt from a stage
 * list." So the halt banner is driven by that boolean and not by scanning
 * `stages` for a `halted` phase; the two can legitimately differ, and the
 * server is the one that knows.
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
    <div className="flex flex-col gap-12 p-14" data-testid="extraction">
      {/* Rule 6: a coloured capsule at a moment of record. A halt is one. */}
      {pipeline.data.gate_halted && (
        <Badge tone="halt">◆ The gate has halted this order</Badge>
      )}

      <MetaStrip pipeline={pipeline.data} />

      <Card padding="none">
        <CardHeader>Sequential stages</CardHeader>
        <CardBody>
          <StageTimeline stages={pipeline.data.stages} />
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader>Pages</CardHeader>
        <CardBody className="flex flex-col gap-6">
          {pages.data === undefined ? (
            <p className="font-sans text-meta leading-body text-ink-faint">
              {pages.isError
                ? "The page list could not be read."
                : "Reading the page list…"}
            </p>
          ) : (
            <>
              <PageMatrix orderId={props.orderId} pages={pages.data.pages} />
              <p className="font-sans text-label leading-body text-ink-muted">
                Cream is a page the run read; muted red is the server&apos;s
                degraded finding. Bold is read in full. Choosing a page opens the
                workstation there.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader>Policy exceptions</CardHeader>
        <CardBody>
          <PolicyExceptions orderId={props.orderId} />
        </CardBody>
      </Card>

      <BackendGap
        object="Run log terminal"
        conversation="entities.ts:17-19 · CONTEXT §14"
      >
        The design streams the run&apos;s log lines into a dark terminal. This
        is a refusal rather than a missing shape: probes are never visible in
        any client, and the contract deliberately holds no schema a screen could
        consume. Run output is the pipeline describing its own attempts, which
        is what that rule names.
      </BackendGap>
    </div>
  );
}
