import { useState } from "react";
import { IngestForm } from "./IngestForm";
import { BLANK_ORDER, packageForm, type Stage } from "./stages";
import { RefusedCard } from "./RefusedCard";
import { AcceptCard, AcceptedCard } from "./AcceptCard";
import { useAcceptOrder, useUploadPackage } from "./useIngest";

/**
 * SCREEN 5 — INTAKE / UPLOAD, at `/ingest` (authz.ts:67, ops+admin).
 *
 * Four stages: form → (refused) → accept → accepted.
 *
 * INVARIANT 47 (`docs/INVARIANTS.md:131`): "Acceptance is explicit — an upload
 * alone never queues an order." `accept` is a stage rather than a button on
 * the form because the two acts have to be visibly separate: the order EXISTS
 * after the upload and is NOT queued, and a design that draws one "Sign"
 * button cannot say that. Nothing chains the mutations — `useUploadPackage`'s
 * success handler advances the stage and does not call accept.
 *
 * `banner` carries the SERVER's sentence for a failure that is not a
 * field-level rejection, which is where a duplicate lands: INVARIANT 48 /
 * `INVARIANTS:132`, a byte-identical re-upload surfaces the server's
 * sha256-match notice, and it surfaces verbatim (INVARIANTS 58-59). The client
 * never writes that sentence, which is also why there is no sha256 rendering
 * of our own — no response in the contract carries the hash as data.
 *
 * What this screen deliberately does NOT draw is recorded on `IngestForm`:
 * the quarantine gateway checklist and the optical profile card, both
 * unbacked (ANALYSIS-screens.md §7 conversation 3).
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
        <ScreenHeading />

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
            uploading={upload.isPending}
            onValue={(key, value) =>
              setValues((previous) => ({ ...previous, [key]: value }))
            }
            onFile={setFile}
            onSubmit={() => upload.mutate(packageForm(values, file))}
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
          <AcceptCard
            order={stage.order}
            fileName={stage.fileName}
            pending={accept.isPending}
            onAccept={() => accept.mutate(stage.order)}
          />
        )}

        {stage.kind === "accepted" && (
          <AcceptedCard order={stage.order} onAgain={restart} />
        )}
      </div>
    </div>
  );
}

/** Rule 4: ALL-CAPS is legal on a rubric; the title beneath it is sentence case. */
function ScreenHeading() {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="font-sans text-title font-bold leading-tight text-ink-primary">
        Package intake
      </h1>
    </header>
  );
}
