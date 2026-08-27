import type { CreateOrderRequest } from "@titlepipe/contract";
import { Button, Card, CardBody, CardHeader } from "../../components/ui";
import { BackendGap } from "../../entities/gap/BackendGap";
import { Dropzone } from "./Dropzone";
import { OrderFields } from "./OrderFields";
import { RulebookBanner } from "./RulebookBanner";

/**
 * THE TWO-COLUMN CARD — the package on the left, the order on the right.
 * Design §Screens 5's opening state, and act one of two.
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
    <div className="grid grid-cols-2 items-start gap-12">
      <Card padding="none">
        <CardHeader>The package</CardHeader>
        <CardBody className="flex flex-col gap-8">
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

          <div className="flex flex-wrap items-center gap-6">
            <Button
              data-testid="upload-btn"
              onPress={props.onSubmit}
              disabledBecause={
                props.uploading ? "Uploading the package…" : undefined
              }
            >
              Upload the package
            </Button>
            <span className="font-sans text-label leading-close text-ink-muted">
              Uploading does not queue it. Signing does.
            </span>
          </div>
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader>The order — what the PDF cannot say</CardHeader>
        <CardBody className="flex flex-col gap-8">
          <OrderFields values={props.values} onChange={props.onValue} />
          <RulebookBanner clientId={props.values.client_id} />
        </CardBody>
      </Card>
    </div>
  );
}
