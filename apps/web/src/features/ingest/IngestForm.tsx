import type { CreateOrderRequest } from "@titlepipe/contract";
import { Button, Card } from "../../components/ui";
import { BackendGap } from "../../entities/gap/BackendGap";
import { Dropzone } from "./Dropzone";
import { OrderFields } from "./OrderFields";
import { RulebookBanner } from "./RulebookBanner";

/**
 * THE INTAKE CARD — the package on the left, the order on the right, one act
 * across the bottom. `reference-app.html`'s `isUpload`, and act one of two.
 *
 * ══ THE TWO OBJECTS THE DESIGN DRAWS BETWEEN THE FILE ROW AND THE BUTTON ═══
 *
 * Neither is built, and neither is mocked. `ANALYSIS-screens.md` §7
 * conversation 3 is the record of asking the backend owner for both:
 *
 *   - THE QUARANTINE GATEWAY CHECKLIST (AV → real-PDF → SHA-256, sequential,
 *     three states each, pulsing dot). No quarantine-step shape exists
 *     anywhere in the contract. A four-step state machine written in the
 *     browser is exactly what AGENTS.md hard rule 3 forbids, and its step
 *     LABELS would be a second copy of product copy drifting from the
 *     server's — the argument `LifecycleStamp.label` (intake.ts:275) settles.
 *   - THE OPTICAL PROFILE CARD (DPI, clerk stamp located, contrast floor).
 *     Three THRESHOLDS, and thresholds are server-owned without exception.
 *     Whether they may be shown at all is additionally an open question about
 *     probe visibility (CONTEXT §14, entities.ts:17-19) — which is a question
 *     for the owner, not something to resolve by drawing it.
 *
 * There is no sha256 line either, for the same reason: no response in the
 * contract carries the hash as data. It arrives only as prose inside a 409,
 * which is where the screen renders it — verbatim, in the banner above.
 *
 * ══ RULE 1: THE ACCENT IS NOT SPENT HERE ═══════════════════════════════════
 *
 * "Upload the package" is a SECONDARY button. The screen's one accent spend is
 * "Accept — sign for it" on the next stage, because acceptance is the act that
 * matters (INVARIANT 47) and the accent goes to the decision, not to the
 * transfer.
 */
export function IngestForm(props: {
  readonly values: CreateOrderRequest;
  readonly file: File | null;
  readonly uploading: boolean;
  readonly onValue: (key: keyof CreateOrderRequest, value: string) => void;
  readonly onFile: (file: File | null) => void;
  readonly onSubmit: () => void;
}) {
  return (
    /*
     * ONE CARD, TWO COLUMNS, ONE FOOTER — `reference-app.html`'s `isUpload`.
     * This was two side-by-side cards, which reads as two unrelated forms; the
     * design puts both halves in one surface under "Package Document" and
     * "Order Configuration" precisely because neither is submittable without
     * the other, and it spans the act across the bottom of both.
     */
    <Card padding="none">
      <div className="grid grid-cols-2 items-start">
        <div className="flex flex-col gap-8 border-r border-line-subtle p-12">
          <h2 className="text-label font-semibold leading-flat text-ink-faint">
            Package document
          </h2>
          <Dropzone file={props.file} onFile={props.onFile} />

          <BackendGap
            object="Quarantine gateway — AV, real-PDF, SHA-256"
            conversation="ANALYSIS-screens.md §7 conversation 3"
          >
            The design runs three named checks in sequence with a state each. No
            quarantine-step shape exists in the contract, and no response
            carries the sha256 as data — it arrives only as prose inside a
            duplicate&apos;s 409. Drawing the checklist would put a four-step
            state machine, and its product copy, in the browser.
          </BackendGap>

          <BackendGap
            object="Optical profile — DPI, clerk stamp, contrast floor"
            conversation="ANALYSIS-screens.md §7 conversation 3"
          >
            Three quality thresholds with no home in the contract. Thresholds
            are server-owned, and whether they may be shown at all is an open
            question about probe visibility (CONTEXT §14).
          </BackendGap>
        </div>

        <div className="flex flex-col gap-8 p-12">
          <h2 className="text-label font-semibold leading-flat text-ink-faint">
            Order configuration
          </h2>
          <OrderFields values={props.values} onChange={props.onValue} />

          {/*
           * CONTRACT GAP: the design's PRODUCT select has no field to write to.
           * `CreateOrderRequest` (endpoints.ts:39-45) has exactly five members —
           * `client_id`, `external_ref`, `jurisdiction`, `state`, `county` — and
           * no `product_id: string`. `Order.product` (entities.ts) is nullable
           * and SERVER-RESOLVED, so a product chosen here would be sent nowhere
           * and silently dropped.
           *
           * It is stated on screen rather than left as a hole because the gap
           * has a visible consequence one line below: `EffectiveChecklist`
           * (workspace.ts:118) is keyed on client AND product, so with no
           * product to narrow by, the banner names EVERY product's checklist
           * for the chosen client rather than the one this order will use.
           */}
          <BackendGap
            object="Product — the second half of the checklist key"
            conversation="CONTRACT GAP: CreateOrderRequest, endpoints.ts:39-45"
          >
            The design picks a product here and resolves one checklist from it.
            There is no product field on the create request, so nothing carries
            the choice to the server. Until there is, the banner below names
            every checklist this client has rather than pretending to know
            which one applies.
          </BackendGap>

          <RulebookBanner clientId={props.values.client_id} />
        </div>
      </div>

      {/* The footer spans both columns, as the design's does. */}
      <div className="flex flex-wrap items-center justify-between gap-6 border-t border-line-subtle px-12 py-8">
        <span className="font-sans text-meta leading-close text-ink-muted">
          Uploading does not queue it. Signing does.
        </span>
        <Button
          data-testid="upload-btn"
          onPress={props.onSubmit}
          disabledBecause={props.uploading ? "Uploading the package…" : undefined}
        >
          Upload the package
        </Button>
      </div>
    </Card>
  );
}
