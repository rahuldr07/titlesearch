import { Badge, Card } from "../../components/ui";
import { RouteButton } from "../../app/chrome/RouteButton";
import { useRead } from "../../app/useRead";
import { orderContext, orderFields, orderPages, orderPipeline } from "../../shared/queries";
import { ExtractionHeader } from "./ExtractionHeader";
import { MetaStrip } from "./MetaStrip";
import { PageMatrix, PageMatrixLegend } from "./PageMatrix";
import { PolicyExceptions } from "./PolicyExceptions";
import { StageTimeline } from "./StageTimeline";
import { TerminalLog } from "./TerminalLog";
import { CardTitle } from "./cardTitle";

/**
 * Extraction, a sub-view of `/orders/$orderId` rather than a route of its own
 * — the frozen door list holds no extraction path.
 *
 * `gate_halted` is read off the response. The halt badge never scans `stages`
 * for a halted phase — the two can legitimately differ.
 */
export function ExtractionView(props: { readonly orderId: string }) {
  const pipeline = useRead(orderPipeline(props.orderId));
  const pages = useRead(orderPages(props.orderId));
  const context = useRead(orderContext(props.orderId));
  const fields = useRead(orderFields(props.orderId));
  const remaining = fields.data?.census?.remaining;

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
      <ExtractionHeader orderId={props.orderId} etaLabel={pipeline.data.eta_label} />

      {pipeline.data.gate_halted && (
        <Badge tone="halt">◆ The gate has halted this order</Badge>
      )}

      <MetaStrip
        pipeline={pipeline.data}
        orderRef={context.data?.order_ref ?? null}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-12">
        <div className="flex min-w-0 flex-col gap-12">
          <Card>
            <CardTitle>Sequential extraction stages</CardTitle>
            <StageTimeline stages={pipeline.data.stages} />
            {/* Standing copy — a product rule, not a reading of any response:
                judgments never auto-confirm and engine self-confidence never
                gates a confirm. */}
            <p className="mt-12 rounded-r-lg border-l-4 border-action bg-action-surface p-8 font-sans text-meta font-medium leading-body text-ink-secondary">
              Engine confidence is recorded for telemetry and is never used to
              bypass a human read. Every conflict is confirmed by an examiner,
              and no escalation is resolved without a rule.
            </p>
            {/* `remaining` is the server's census figure; absent means the
                server did not say, and the footer stays down rather than
                inventing a count. */}
            {remaining !== undefined && remaining > 0 && (
              <div className="mt-12 flex items-center justify-between gap-8 rounded-lg border border-line-subtle bg-surface-sunken p-8">
                <span className="font-sans text-meta font-bold leading-close text-ink-primary">
                  {remaining === 1
                    ? "1 exception securely routed to human review"
                    : `${remaining} exceptions securely routed to human review`}
                </span>
                <RouteButton
                  variant="primary"
                  to="/orders/$orderId/review"
                  params={{ orderId: props.orderId }}
                  data-testid="extraction-enter-review"
                >
                  Enter Examination Workstation →
                </RouteButton>
              </div>
            )}
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
          <TerminalLog lines={pipeline.data.run_log} />
          <PolicyExceptions orderId={props.orderId} />
        </div>
      </div>
    </div>
  );
}
