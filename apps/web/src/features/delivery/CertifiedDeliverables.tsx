import type { DeliveryWithReport } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * CERTIFIED DELIVERABLES — the artifact rows, and the SHA chip that cannot be.
 *
 * Design §Screens 9: "artifact rows (PDF chip, name 16px, meta mono 11px, View
 * routes honestly)" under a "header + SHA chip". The design's own words are
 * doing the work here: **View routes honestly**. There is nothing to route to.
 * `Report` (entities.ts:216-222) has no file, no url, no filename, no byte
 * count and no digest; `Delivery.evidence` is a free-text line, not an
 * artifact.
 *
 * So the row keeps the prototype's shape — tile, name, tag, meta line — and
 * drops the View control, because a control that cannot route anywhere is
 * worse than an absent one: it teaches a reader the file exists somewhere they
 * have not looked.
 *
 * THE TILE IS PAPER, NOT A "PDF" CHIP AND NOT A GREY BAR (rule 8). The
 * prototype letters it "PDF", which asserts a file; what the contract asserts
 * is that a report was RENDERED (`rendered_at`) at a VERSION, so the tile is a
 * page edge in the paper stock carrying the version numeral in serif. Nothing
 * on it claims a downloadable object.
 *
 * ══ THE SHA CHIP IS THE SHARPEST CASE ══════════════════════════════════════
 *
 * A hash is the one value on this screen a reader would trust WITHOUT
 * CHECKING — that is what a digest is for. Rendering a plausible one is
 * therefore not a cosmetic lie, it is the exact failure root AGENTS.md
 * principle 6 names ("never emit a value you can't cite", caught 6 times in
 * prototyping) at its most consequential. The chip is absent and says why.
 *
 * The intake sha256 IS real (design §Screens 5, the quarantine gateway) and is
 * a different hash of a different object: the county PACKAGE that came in, not
 * the report that went out. Borrowing it here would be worse than inventing
 * one, because it would verify.
 */
export function CertifiedDeliverables({
  deliveries,
}: {
  readonly deliveries: readonly DeliveryWithReport[];
}) {
  return (
    <Card padding="none">
      <CardHeader>
        <span>Certified deliverables</span>
        {/* The prototype's "N files · immutable". Rows, not files: a file is
            the thing the contract does not have. */}
        <span className="font-mono text-label leading-flat font-semibold text-ink-muted">
          {deliveries.length === 1
            ? "one on the record"
            : `${String(deliveries.length)} on the record`}
        </span>
      </CardHeader>

      <div className="flex flex-col">
        {deliveries.map((delivery) => (
          <div
            key={delivery.id}
            data-testid={`deliverable-${delivery.id}`}
            className="flex items-center gap-8 border-b border-line-subtle px-12 py-8 last:border-b-0"
          >
            <span className="flex h-24 w-20 shrink-0 items-center justify-center rounded-paper border border-page-line bg-surface-paper font-serif text-label leading-flat font-bold text-page-ink">
              {delivery.report === null ? "—" : `v${String(delivery.report.version)}`}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex min-w-0 items-center gap-4">
                <span className="truncate font-sans text-body leading-close font-semibold text-ink-primary">
                  Title report · {delivery.report?.order_id ?? "no report on this delivery"}
                </span>
                <span className="shrink-0 rounded-pill bg-control-fill px-4 py-1 font-mono text-label leading-flat font-semibold text-ink-muted">
                  {delivery.method}
                </span>
              </span>
              <span className="font-mono text-label leading-close text-ink-muted">
                {delivery.report === null
                  ? `delivery ${delivery.id}`
                  : `shape ${delivery.report.shape} · rendered ${delivery.report.rendered_at}`}
              </span>
            </span>
          </div>
        ))}
      </div>

      <CardBody>
        <ContractGap
          drawn="SHA chip on the header, and a PDF chip with a View action per artifact row (design §Screens 9)"
          has={
            <>
              `Report` (entities.ts:216-222) is `id`, `order_id`, `version`,
              `shape`, `rendered_at`. No digest, no file reference, no filename,
              no size, and no artifact entity anywhere in the contract. The
              design says "View routes honestly" — honestly, it routes nowhere,
              so there is no View. The intake sha256 is a hash of the incoming
              county package, not of the delivered report, and reusing it here
              would produce a chip that verifies the wrong object.
            </>
          }
          needs={
            <>
              An artifact shape carrying the digest, media type and a retrieval
              path, and a permission row for who may fetch one. Backend
              conversation 2 (ANALYSIS-screens.md §Conversation 2, "Where does
              the deliverable SHA surface as structured data?").
            </>
          }
        />
      </CardBody>
    </Card>
  );
}
