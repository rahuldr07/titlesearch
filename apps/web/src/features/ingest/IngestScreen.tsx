import { useState } from "react";
import { IngestForm } from "./IngestForm";
import { BLANK_ORDER, packageForm, type Stage } from "./stages";
import { RefusedCard } from "./RefusedCard";
import { AcceptedCard } from "./AcceptedCard";
import { useSignForPackage } from "./useIngest";
import { useQuarantineScan } from "./useQuarantineScan";

/**
 * Intake at `/ingest` (ops/admin). The gateway runs inline — the pre-order
 * scan starts the moment a file lands — and there is one signed act; the
 * stage router is `form → (refused | accepted)`.
 *
 * `banner` carries the server's sentence for a failure that is not a
 * field-level rejection: a byte-identical re-upload surfaces the server's
 * sha256-match notice verbatim.
 */
export function IngestScreen() {
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [values, setValues] = useState(BLANK_ORDER);
  const [file, setFile] = useState<File | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const scan = useQuarantineScan();

  const sign = useSignForPackage({
    onSigned: (order) => {
      setBanner(null);
      setStage({ kind: "accepted", order });
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

  function choose(next: File | null) {
    setFile(next);
    if (next === null) scan.reset();
    else scan.scan(next);
  }

  function restart() {
    setStage({ kind: "form" });
    setValues(BLANK_ORDER);
    setFile(null);
    setBanner(null);
    scan.reset();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-12 p-14">
        <header className="flex flex-col gap-4">
          <span className="w-fit rounded-pill border border-action-border bg-action-surface px-5 py-2 font-sans text-label font-semibold leading-flat text-ink-secondary">
            Intake &amp; Quarantine Gateway
          </span>
          <h1 className="font-sans text-title font-bold leading-tight tracking-tight text-ink-primary">
            Package Intake &amp; Registration
          </h1>
          <p className="max-w-320 font-sans text-body leading-body text-ink-muted">
            Upload scanned county abstract documents. Files undergo automated
            SHA-256 verification and antivirus quarantine before binding to
            examiner workstation.
          </p>
        </header>

        {(banner !== null || scan.failure !== null) && (
          <p
            data-testid="ingest-banner"
            role="alert"
            className="rounded-md border border-state-attend-border bg-state-attend-surface px-8 py-6 font-sans text-meta leading-body text-state-attend"
          >
            {banner ?? scan.failure}
          </p>
        )}

        {stage.kind === "form" && (
          <IngestForm
            values={values}
            file={file}
            scan={scan}
            pending={sign.pending}
            onValue={(key, value) =>
              setValues((previous) => ({ ...previous, [key]: value }))
            }
            onFile={choose}
            onSign={() => sign.send(packageForm(values, file))}
          />
        )}

        {stage.kind === "refused" && (
          <RefusedCard
            rejection={stage.rejection}
            fileName={stage.fileName}
            onBack={() => setStage({ kind: "form" })}
          />
        )}

        {stage.kind === "accepted" && (
          <AcceptedCard order={stage.order} onAgain={restart} />
        )}
      </div>
    </div>
  );
}
