import type { CompositionResponse } from "@titlepipe/contract";
import { PaperSheet } from "../../entities/evidence/PaperSheet";
import { ClerkStamp } from "../../entities/evidence/ClerkStamp";
import { AppendCondition } from "./AppendCondition";
import { IntegritySeal } from "./IntegritySeal";
import { DraftWatermark } from "./DraftWatermark";

/**
 * THE COMPOSED REPORT, AS PAPER (rule 8).
 *
 * Every block's `body` is prose the server assembled; it is printed, never
 * reflowed into fields or summarised. There are no placeholder bars anywhere on
 * this sheet — a deliverable that renders as grey rectangles teaches a reviewer
 * to read a finished page as an unfinished one.
 *
 * The stamp is pressed only when the server has returned a seal. A stamp on an
 * unreleased sheet is a recording that never happened, and the watermark is the
 * same test read the other way: composed but unsealed is a draft, and it says so
 * across the page rather than only in the footer.
 *
 * The design's dateline reads "Order {ref} · {county} · Template v4.2". The
 * county is not on `CompositionResponse` and the version is never a literal, so
 * the line is the order id and the server's `template_version`, and stops there.
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
            <p className="pt-6 font-serif text-body leading-document text-page-ink">
              {block.body}
            </p>
          </section>
        ))}
      </div>

      <div className="pt-12">
        <AppendCondition />
      </div>

      <footer className="mt-12 border-t-2 border-page-ink pt-8">
        <IntegritySeal seal={composed.seal_sha256} />
      </footer>
    </PaperSheet>
  );
}
