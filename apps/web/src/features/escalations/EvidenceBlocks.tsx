import { Link } from "@tanstack/react-router";
import type { Escalation } from "@titlepipe/contract";
import { Button, Card, CardBody, CardHeader } from "../../components/ui";

/**
 * The docket excerpt on paper, split at the boxed match; "View on page →"
 * jumps to the cited page on the workstation (`?page=`).
 */
export function DocketExcerpt({
  escalation,
  orderId,
}: {
  readonly escalation: Escalation;
  readonly orderId: string | null;
}) {
  const excerpt = escalation.excerpt;
  if (excerpt === null) return null;
  return (
    <div
      data-testid="docket-excerpt"
      className="overflow-hidden rounded-md border border-action-border"
    >
      <div className="flex items-center justify-between gap-4 border-b border-action-border bg-action-surface px-7 py-3">
        <span className="font-sans text-label leading-flat font-semibold text-ink-muted">
          {excerpt.note ?? `Source excerpt · ${excerpt.doc_id} · p${String(excerpt.page)}`}
        </span>
        {orderId !== null && (
          <Link
            to="/orders/$orderId/review"
            params={{ orderId }}
            search={{ page: excerpt.page }}
            data-testid="excerpt-view-on-page"
            className="tp-state font-sans text-label leading-flat font-semibold text-action hover:underline"
          >
            View on page →
          </Link>
        )}
      </div>
      <p className="bg-surface-paper px-8 py-7 font-serif text-body leading-document text-page-ink">
        {excerpt.pre}
        <mark className="border border-action-border-strong bg-action-surface px-2 text-page-ink">
          {excerpt.hit}
        </mark>
        {excerpt.post}
      </p>
    </div>
  );
}

/**
 * The determination for a seat that does not hold it — visible and disabled
 * under the hint; the button's disablement carries the same sentence.
 */
export function LockedDetermination({ escalation }: { readonly escalation: Escalation }) {
  const hint =
    escalation.qc_owner !== null
      ? `This determination belongs to QC — with ${escalation.qc_owner}. You are signed in without the QC grant — read-only here.`
      : "This determination belongs to QC. You are signed in without the QC grant — read-only here.";
  return (
    <Card padding="none">
      <CardHeader>The determination</CardHeader>
      <CardBody className="flex flex-col gap-6">
        <p
          data-testid="determination-belongs-to-qc"
          className="rounded-md border border-state-attend-border bg-state-attend-surface px-7 py-5 font-sans text-meta leading-body text-state-attend"
        >
          {hint}
        </p>
        <div>
          <Button data-testid="resolve-btn-locked" variant="primary" disabledBecause={hint}>
            Resolve the cluster
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** The debtor-vs-owner comparison grid — both columns quoted from the record
 * by the server. */
export function IdentityGrid({
  identity,
}: {
  readonly identity: NonNullable<Escalation["identity"]>;
}) {
  return (

            <div
              data-testid="identity-grid"
              className="grid grid-cols-2 overflow-hidden rounded-md border border-line-strong"
            >
              <div className="flex flex-col gap-1 border-r border-line-strong px-7 py-5">
                <span className="font-sans text-label leading-flat font-semibold text-ink-muted">
                  {identity.debtor_label}
                </span>
                <span className="font-mono text-body leading-close font-semibold text-ink-primary">
                  {identity.debtor}
                </span>
              </div>
              <div className="flex flex-col gap-1 px-7 py-5">
                <span className="font-sans text-label leading-flat font-semibold text-ink-muted">
                  {identity.owner_label}
                </span>
                <span className="font-mono text-body leading-close font-semibold text-ink-primary">
                  {identity.owner}
                </span>
              </div>
            </div>
            );
}
