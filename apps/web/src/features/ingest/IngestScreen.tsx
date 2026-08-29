import { useState } from "react";
import { IngestForm } from "./IngestForm";
import { BLANK_ORDER, packageForm, type Stage } from "./stages";
import { RefusedCard } from "./RefusedCard";
import { AcceptCard } from "./AcceptCard";
import { AcceptedCard } from "./AcceptedCard";
import { useAcceptOrder, useUploadPackage } from "./useIngest";
import { QuarantinePanel } from "./QuarantinePanel";

/**
 * SCREEN 5 — INTAKE / UPLOAD, at `/ingest` (authz.ts:67, ops+admin). The stage
 * router for `form → (refused) → accept → accepted`, and nothing else.
 *
 * INVARIANT 47 (`docs/INVARIANTS.md:131`): "Acceptance is explicit — an upload
 * alone never queues an order." `accept` is a STAGE rather than a button on the
 * form because the two acts have to be visibly separate: after the upload the
 * order EXISTS and is NOT queued, and a design that draws one "Sign" button
 * cannot say that. Nothing chains the mutations.
 *
 * `banner` carries the SERVER's sentence for a failure that is not a
 * field-level rejection, which is where a duplicate lands: a byte-identical
 * re-upload surfaces the server's sha256-match notice verbatim (INVARIANT 48,
 * `INVARIANTS:132`, 58-59). The hash itself is DATA since the 2026-08-28
 * ruling — `QuarantineResponse.sha256` (design2.ts:37) — and renders on the
 * accept stage via `QuarantinePanel`, where an order id exists to read it
 * against.
 */
export function IngestScreen() {
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [values, setValues] = useState(BLANK_ORDER);
  const [file, setFile] = useState<File | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const upload = useUploadPackage({
    onUploaded: (order) => {
      setBanner(null);
      setStage({ kind: "accept", order, fileName: file?.name ?? "the package" });
    },
    onRefused: (rejection) => {
      setBanner(null);
      setStage({
        kind: "refused",
        rejection,
        fileName: file?.name ?? "no file chosen",
      });
    },
    onFailed: setBanner,
  });

  const accept = useAcceptOrder({
    onAccepted: (order) => setStage({ kind: "accepted", order }),
    onFailed: setBanner,
  });

  function restart() {
    setStage({ kind: "form" });
    setValues(BLANK_ORDER);
    setFile(null);
    setBanner(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-12 p-14">
        <header className="flex flex-col gap-4">
          <h1 className="font-sans text-title font-bold leading-tight text-ink-primary">
            Package intake &amp; registration
          </h1>
          {/* The reference's lede, kept because every clause is true of this
              flow: quarantine (design2.ts) runs before the sign that queues. */}
          <p className="max-w-320 font-sans text-body leading-body text-ink-muted">
            Upload scanned county abstract documents. Files undergo automated
            SHA-256 verification and antivirus quarantine before an examiner
            signs for the package.
          </p>
        </header>

        {banner !== null && (
          <p
            data-testid="ingest-banner"
            role="alert"
            className="rounded-md border border-state-attend-border bg-state-attend-surface px-8 py-6 font-sans text-meta leading-body text-state-attend"
          >
            {banner}
          </p>
        )}

        {stage.kind === "form" && (
          <IngestForm
            values={values}
            file={file}
            uploading={upload.pending}
            onValue={(key, value) =>
              setValues((previous) => ({ ...previous, [key]: value }))
            }
            onFile={setFile}
            onSubmit={() => upload.send(packageForm(values, file))}
          />
        )}

        {stage.kind === "refused" && (
          <RefusedCard
            rejection={stage.rejection}
            fileName={stage.fileName}
            onBack={() => setStage({ kind: "form" })}
          />
        )}

        {stage.kind === "accept" && (
          <>
            <AcceptCard
              order={stage.order}
              fileName={stage.fileName}
              pending={accept.pending}
              onAccept={() => accept.send(stage.order)}
            />
            {/* The server's quarantine verdicts, readable now the order has an
                id. Rendering them here rather than on the form is INVARIANT
                47's split, restated for a read. */}
            <QuarantinePanel order={stage.order} />
          </>
        )}

        {stage.kind === "accepted" && (
          <AcceptedCard order={stage.order} onAgain={restart} />
        )}
      </div>
    </div>
  );
}
