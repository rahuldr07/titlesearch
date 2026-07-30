import { useState } from "react";
import type { Order } from "@titlepipe/contract";
import { useAcceptOrder, useUploadPackage } from "./queries";
import { ClientPicker } from "./ClientPicker";
import { ProductPicker } from "./ProductPicker";
import { OrderForm } from "./OrderForm";
import { DropZone } from "./DropZone";
import { ORDER_FIELDS } from "./orderFields";
import { RefusedCard } from "./RefusedCard";
import { AcceptedCard } from "./AcceptedCard";
import { IngestActs } from "./IngestActs";
import { ApiError } from "../../shared/api";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";

interface Refusal {
  missing_fields: string[];
  reason: string;
}

/**
 * INGEST — the door.
 *
 * ONE NARROW COLUMN, CENTRED. The design gives intake half the width it gives a
 * review screen, and that is the point: this is a single errand done in order,
 * top to bottom, not a workspace to range around in. Below the drop zone the
 * body is the design's four blocks — the receipt for the file in hand, the
 * CLIENT picker, the PRODUCT ORDERED picker, and the press that advances.
 *
 * ALMOST NOTHING HERE IS TYPED. The two decisions intake makes are chosen from
 * lists the server serves, because both of them resolve something: the client
 * resolves the effective sign-off, the product sets the scope. Only the fields
 * no endpoint can offer as a list are still text.
 *
 * AN UPLOAD ALONE NEVER QUEUES AN ORDER (`ingest.spec` #2) — the two presses
 * and why they are two live in `IngestActs`.
 *
 * A DUPLICATE IS THE SERVER'S FINDING, not the client's. The sha256 match lives
 * where the bytes are; the screen surfaces the message and does not attempt to
 * recognise a re-upload on its own.
 */
export function IngestScreen() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [clientId, setClientId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [created, setCreated] = useState<Order | null>(null);
  const [accepted, setAccepted] = useState<Order | null>(null);
  const upload = useUploadPackage();
  const accept = useAcceptOrder();

  const reset = () => {
    setValues({});
    setClientId(null);
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
    // Unchosen means UNSENT, never an empty string: the door's refusal names
    // the field it did not receive, and a blank one would be a value.
    if (clientId !== null) form.append("client_id", clientId);
    if (file !== null) form.append("package", file);
    upload.mutate(form, {
      onSuccess: (result) => {
        setRefusal(result.ok ? null : result.refusal);
        setCreated(result.ok ? result.data.order : null);
      },
    });
  };

  return (
    <Screen measure="560" pad="40" placement="centre">
      <div className="flex flex-col gap-9">
        <ScreenHeading
          size="26"
          eyebrow="Step 1 — Upload"
          title="New title-search package"
          lede="One scanned PDF per order. Nothing leaves this tool as a deliverable until a reviewer has approved it, field by field."
        />

        {/* NOT a `RefusalNudge`: the server's verdict on the whole request, not a
            control naming what it lacks — there is no control id to describe, and the nudge's own fixed testid would rename the `ingest-banner` gate. */}
        {upload.error instanceof ApiError ? (
          <p data-testid="ingest-banner" role="alert" className="text-xs font-semibold text-state-halt-ink">
            {upload.error.message}
          </p>
        ) : null}

        {refusal === null ? null : (
          <RefusedCard missing={refusal.missing_fields} reason={refusal.reason} />
        )}

        {accepted !== null ? (
          <AcceptedCard orderRef={accepted.external_ref} onAnother={reset} />
        ) : (
          <>
            <DropZone file={file} onFile={setFile} />
            <ClientPicker value={clientId} onSelect={setClientId} />
            <ProductPicker />
            <OrderForm
              values={values}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            />

            <IngestActs
              uploading={upload.isPending}
              uploaded={created !== null}
              accepting={accept.isPending}
              onUpload={submit}
              onAccept={() => {
                if (created === null) return;
                accept.mutate(created.id, { onSuccess: () => setAccepted(created) });
              }}
            />
          </>
        )}
      </div>
    </Screen>
  );
}
