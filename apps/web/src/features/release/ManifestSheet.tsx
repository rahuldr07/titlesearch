import { Link } from "@tanstack/react-router";
import type { CompositionResponse, ManifestValue } from "@titlepipe/contract";
import { PaperSheet } from "../../entities/evidence/PaperSheet";
import { ClerkStamp } from "../../entities/evidence/ClerkStamp";
import { AppendCondition } from "./AppendCondition";
import { IntegritySeal } from "./IntegritySeal";
import { DraftWatermark } from "./DraftWatermark";

/**
 * The composed report, as paper. A pending value renders amber with a dashed
 * underline and clicks through to that field in the workstation (`?field=`);
 * both the flag and the destination are the server's (`ManifestValue.pending`,
 * `.field_id`) — nothing here derives pendingness from the gates. The stamp is
 * pressed only when the server has returned a seal; composed but unsealed is a
 * draft and says so across the page.
 */
export function ManifestSheet(props: { readonly composed: CompositionResponse }) {
  const { composed } = props;

  return (
    <PaperSheet
      stock="page"
      className="w-full max-w-420"
      {...(composed.seal_sha256 !== null
        ? {
            stamp: (
              <ClerkStamp caption="Released" detail={`Template ${composed.template_version}`} />
            ),
          }
        : {})}
    >
      {composed.seal_sha256 === null && <DraftWatermark />}

      <header className="flex flex-col items-center gap-5 border-b border-page-ink pb-8 text-center">
        <h2 className="font-serif text-title leading-tight tracking-caps uppercase text-page-ink">
          Report of title
        </h2>
        <p className="font-sans text-label leading-close text-scan-ink">
          <span className="font-mono">{composed.order_id}</span>
          {" · Template "}
          <span className="font-mono">{composed.template_version}</span>
        </p>
      </header>

      <div data-testid="manifest-blocks" className="flex flex-col gap-12 pt-12">
        {composed.blocks.map((block) => (
          <section key={block.id} id={`manifest-${block.id}`} data-testid={`manifest-${block.id}`}>
            <h3 className="flex items-baseline justify-between gap-6 border-b border-page-line pb-4 text-meta leading-close text-page-ink">
              <span className="font-serif tracking-caps uppercase">
                {`${block.numeral} · ${block.title}`}
              </span>
              {/* No mark: whether a block is short of citations is a gate's
                  verdict, not ours. */}
              <span className="shrink-0 font-sans text-label leading-close text-scan-ink">
                {`${String(block.cited)} of ${String(block.field_count)} cited`}
              </span>
            </h3>
            <dl className="flex flex-col gap-5 pt-6">
              {block.values.map((value) => (
                <div
                  key={`${block.id}-${value.label}`}
                  className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] items-baseline gap-8"
                >
                  <dt className="font-sans text-label leading-close tracking-caps uppercase text-scan-ink">{/* rules-allow: the certificate's small-caps label column is drawn uppercase (RULING-2026-08-29) */}
                    {value.label}
                  </dt>
                  <dd className="font-serif text-body leading-document text-page-ink">
                    <ValueSpan orderId={composed.order_id} value={value} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="pt-12">
        <AppendCondition />
      </div>

      <footer className="mt-12 border-t-2 border-page-ink pt-8">
        <IntegritySeal seal={composed.seal_sha256} releasedAt={composed.released_at} />
      </footer>
    </PaperSheet>
  );
}

/**
 * One value span. A pending value with no field to land on (null `field_id`)
 * still reads amber, but there is nothing to click — a dead link would promise
 * a jump the record cannot make.
 */
function ValueSpan({
  orderId,
  value,
}: {
  readonly orderId: string;
  readonly value: ManifestValue;
}) {
  if (!value.pending) return <>{value.value}</>;
  if (value.field_id === null) {
    return (
      <span data-pending className="text-state-attend">
        {value.value}
      </span>
    );
  }
  return (
    <Link
      to="/orders/$orderId/review"
      params={{ orderId }}
      search={{ field: value.field_id }}
      data-pending
      data-testid={`pending-${value.field_id}`}
      title="Pending — click to open in the examination workstation"
      className="tp-state cursor-pointer border-b border-dashed border-state-attend text-state-attend hover:text-state-attend"
    >
      {value.value}
    </Link>
  );
}
