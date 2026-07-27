import { useState } from "react";
import type { Order } from "@titlepipe/contract";
import { useAcceptOrder, useUploadPackage } from "./queries";
import { OrderForm } from "./OrderForm";
import { ORDER_FIELDS } from "./orderFields";
import { RefusedCard } from "./RefusedCard";
import { AcceptedCard } from "./AcceptedCard";
import { ApiError } from "../../shared/api";
import { ScreenTitle } from "../../app/ScreenTitle";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";

interface Refusal {
  missing_fields: string[];
  reason: string;
}

/**
 * INGEST — the door.
 *
 * AN UPLOAD ALONE NEVER QUEUES AN ORDER (`ingest.spec` #2). Acceptance is a
 * second, deliberate act, because signing for a package is what makes a missing
 * document somebody's responsibility. Auto-accepting on upload saves one click
 * and loses the only moment where a person looked at what arrived.
 *
 * A DUPLICATE IS THE SERVER'S FINDING, not the client's. The sha256 match lives
 * where the bytes are; the screen surfaces the message and does not attempt to
 * recognise a re-upload on its own.
 *
 * SCOPE: this is the intake path only. The export's product picker, client
 * overrides, completeness-gate configuration and config versioning are NOT
 * built — rulings Q4–Q10 are open and have no backend counterpart, and
 * `decisions.md` records them as owner calls. Building them from the screens
 * would be generating backend behaviour from pixels.
 */
export function IngestScreen() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [created, setCreated] = useState<Order | null>(null);
  const [accepted, setAccepted] = useState<Order | null>(null);
  const upload = useUploadPackage();
  const accept = useAcceptOrder();

  const reset = () => {
    setValues({});
    setFile(null);
    setRefusal(null);
    setCreated(null);
    setAccepted(null);
    upload.reset();
  };

  const submit = () => {
    const form = new FormData();
    for (const field of ORDER_FIELDS) {
      const value = values[field.key];
      if (value !== undefined && value.trim() !== "") form.append(field.key, value.trim());
    }
    if (file !== null) form.append("package", file);
    upload.mutate(form, {
      onSuccess: (result) => {
        setRefusal(result.ok ? null : result.refusal);
        setCreated(result.ok ? result.data.order : null);
      },
    });
  };

  if (accepted !== null) {
    return (
      <div className="flex flex-col gap-8">
        <ScreenTitle>Ingest</ScreenTitle>
        <AcceptedCard orderRef={accepted.external_ref} onAnother={reset} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <ScreenTitle>Ingest</ScreenTitle>
        <p className="max-w-3xl text-base leading-body text-ink-secondary">
          The order carries what the PDF cannot say. Both arrive together, or
          the door refuses them and says which part is missing.
        </p>
      </header>

      {upload.error instanceof ApiError ? (
        <p data-testid="ingest-banner" role="alert" className="text-xs font-semibold text-state-halt-ink">
          {upload.error.message}
        </p>
      ) : null}

      {refusal === null ? null : (
        <RefusedCard missing={refusal.missing_fields} reason={refusal.reason} />
      )}

      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">The order</Eyebrow>
        </CardHeader>
        <CardBody className="flex flex-col gap-6">
          <OrderForm
            values={values}
            onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            onFile={setFile}
          />
          <div className="flex flex-wrap items-center gap-5">
            <Button disabled={upload.isPending} onClick={submit}>
              upload the package
            </Button>
            {created === null ? null : (
              <Button
                fill="outlined"
                tone="settled"
                data-testid="accept-btn"
                disabled={accept.isPending}
                onClick={() =>
                  accept.mutate(created.id, { onSuccess: () => setAccepted(created) })
                }
              >
                Sign for this package
              </Button>
            )}
          </div>
          {created === null ? null : (
            <p className="text-xs text-state-attend-ink">
              Uploaded, not accepted. Nothing is queued until somebody signs for
              it.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
