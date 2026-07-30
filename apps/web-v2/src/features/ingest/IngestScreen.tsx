import { useState } from "react";
import type { Order } from "@titlepipe/contract";
import { useAcceptOrder, useUploadPackage } from "./queries";
import { OrderForm } from "./OrderForm";
import { DropZone } from "./DropZone";
import { ORDER_FIELDS } from "./orderFields";
import { RefusedCard } from "./RefusedCard";
import { AcceptedCard } from "./AcceptedCard";
import { ApiError } from "../../shared/api";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";
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
 * top to bottom, not a workspace to range around in. Each block — drop the
 * package, name the order, hand it over — is a sheet standing on the grey
 * ground rather than a row inside one chrome card, so the sequence reads as
 * steps instead of as one dense form.
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
 * CONTRACT GAP: the design chooses the CLIENT and the PRODUCT ORDERED from card
 * grids — "resolves the effective sign-off", "sets the questions and the
 * scope". Nothing lists either, and `POST /api/orders` takes neither; it takes
 * the five text fields below. Hard-coding two banks and six products would be
 * inventing a fixture and, worse, would let this screen decide which sign-off
 * list applies to an order. Rulings Q4–Q10 are open on exactly that and
 * `decisions.md` records them as owner calls.
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

            <section className="flex flex-col gap-5">
              <Eyebrow variant="field" as="h2">
                THE ORDER &middot; WHAT THE PDF CANNOT SAY &middot; THE DOOR DECIDES WHAT IS COMPLETE
              </Eyebrow>
              <OrderForm
                values={values}
                onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
              />
            </section>

            <div className="flex flex-col gap-5">
              <Button block size="lg" disabled={upload.isPending} onClick={submit}>
                upload the package
              </Button>
              {created === null ? null : (
                <>
                  <p className="text-xs leading-body text-state-attend-ink">
                    Uploaded, not accepted. Nothing is queued until somebody signs
                    for it.
                  </p>
                  <Button
                    block
                    size="lg"
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
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
