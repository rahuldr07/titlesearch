import { Link } from "@tanstack/react-router";
import type { CompositionResponse, ManifestValue } from "@titlepipe/contract";
import { PaperSheet } from "../../entities/evidence/PaperSheet";
import { ClerkStamp } from "../../entities/evidence/ClerkStamp";
import { AppendCondition } from "./AppendCondition";
import { IntegritySeal } from "./IntegritySeal";
import { DraftWatermark } from "./DraftWatermark";

/**
 * THE COMPOSED REPORT, AS PAPER (rule 8).
 *
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
 * Each block is the labelled value grid the reference draws (170px label
 * column against a serif value), and a PENDING value renders exactly as the
 * reference renders one: amber, dashed underline, clickable — the click lands
 * on that field in the examination workstation (`?field=`, INVARIANT 55).
 * Both the flag and the sentence are the SERVER's (`ManifestValue.pending`,
 * `.field_id`); nothing here derives pendingness from the gates.
 *
 * The stamp is pressed only when the server has returned a seal. A stamp on an
 * unreleased sheet is a recording that never happened, and the watermark is the
 * same test read the other way: composed but unsealed is a draft, and it says so
 * across the page rather than only in the footer.
 */
export function ManifestSheet(props: { readonly composed: CompositionResponse }) {
  const { composed } = props;

  return (
    <PaperSheet
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
        {/* Rule 4's second exception: a serif certificate heading may be caps. */}
        <h2 className="font-serif text-title leading-tight tracking-caps uppercase text-page-ink">
          Report of title
        </h2>
        <p className="font-sans text-label leading-close text-scan-ink">
          {/* Rule 3: an order id and a template version are identifiers. */}
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
              {/* Two server figures printed side by side. No mark: whether a
                  block is short of citations is a gate's verdict, not ours. */}
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
 * One value span. Pending draws the reference's affordance — amber, dashed
 * underline, clickable — and the destination is the workstation field the
 * SERVER named. A pending value with no field to land on (null `field_id`)
 * still reads amber, but there is nothing to click: a dead link would promise
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
