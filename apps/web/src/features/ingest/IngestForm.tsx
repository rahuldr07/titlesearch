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
 * The design's Quarantine Gateway checklist and Optical Profile card are NOT
 * gaps any more: `GET /api/orders/{id}/quarantine` (design2.ts:35-42, mocks
 * design.ts:318) serves both since the 2026-08-28 ruling. They do not render on
 * THIS stage because the read is order-scoped and no order exists until the
 * upload returns one — `QuarantinePanel` draws them on the accept stage, and
 * the note under the dropzone says exactly that, on screen.
 *
 * ONE gap card remains, and its claim is still true: the PRODUCT select.
 * `CreateOrderRequest` (endpoints.ts:39-46) has five members and no product, so
 * a product chosen here would be sent nowhere, and `EffectiveChecklist`
 * (workspace.ts:121) is keyed on client AND product — with no product to narrow
 * by, `RulebookBanner` names every checklist the client has rather than the one
 * this order will use.
 *
 * RULE 1: THE ACCENT IS NOT SPENT HERE. "Upload the package" is a SECONDARY
 * button; the screen's one accent spend is "Accept — sign for it" on the next
 * stage, because acceptance is the act that matters (INVARIANT 47).
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
    /* One card, two columns, one footer: neither half is submittable without
       the other, so two side-by-side cards would read as two unrelated forms. */
    <Card padding="none">
      <div className="grid grid-cols-2 items-start">
        <div className="flex flex-col gap-8 border-r border-line-subtle p-12">
          <h2 className="text-label font-semibold leading-flat text-ink-faint">
            Package document
          </h2>
          <Dropzone file={props.file} onFile={props.onFile} />

          {/* Where the design's checklist sits, the true sentence about when it
              arrives — not a skeleton, which would claim it is loading now. */}
          <p
            data-testid="quarantine-note"
            className="font-sans text-label leading-body text-ink-muted"
          >
            The quarantine gateway — antivirus, real-PDF, SHA-256 de-dup — runs
            against the order the upload creates. Its checklist and the optical
            profile render on the next stage, once the server has an order to
            report against.
          </p>
        </div>

        <div className="flex flex-col gap-8 p-12">
          <h2 className="text-label font-semibold leading-flat text-ink-faint">
            Order configuration
          </h2>
          {/* The gap card sits where the reference seats its Product select —
              directly under Client — so the absence reads in place. */}
          <OrderFields
            values={props.values}
            onChange={props.onValue}
            productSlot={
              <BackendGap
                object="Product — the second half of the checklist key"
                conversation="CONTRACT GAP: CreateOrderRequest, endpoints.ts:39-46"
              >
                The design picks a product here and resolves one checklist from
                it. There is no product field on the create request, so nothing
                carries the choice to the server. Until there is, the banner
                below names every checklist this client has rather than
                pretending to know which one applies.
              </BackendGap>
            }
          />

          <RulebookBanner clientId={props.values.client_id} quarantine={null} />
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
