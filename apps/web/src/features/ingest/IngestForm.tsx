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
 * Three objects the design draws are not built, and each renders a `BackendGap`
 * in its place that states the refusal on screen: the QUARANTINE GATEWAY
 * checklist (no quarantine-step shape exists, and a four-step state machine
 * written in the browser is what hard rule 3 forbids), the OPTICAL PROFILE card
 * (three thresholds, and thresholds are server-owned; probe visibility is
 * additionally open — CONTEXT §14), and the PRODUCT select.
 *
 * The product gap has a visible consequence one line below it:
 * `CreateOrderRequest` (endpoints.ts:39-45) has five members and no product, so
 * a product chosen here would be sent nowhere, and `EffectiveChecklist`
 * (workspace.ts:118) is keyed on client AND product — with no product to narrow
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
