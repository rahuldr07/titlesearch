import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Ack,
  CreateOrderResponse,
  IngestRejection,
  type Order,
} from "@titlepipe/contract";
import { ApiError, api } from "../../api";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { ScreenFrame } from "../../shared/ui/ScreenFrame";
import { InertPending } from "../../shared/ui/states";

/**
 * Ingest — step 1 of the design's Upload screen: one scanned PDF becomes an
 * order, and a named person signs for it.
 *
 * Three rules hold this screen up, and all three live on the server:
 *
 *   1. THE REFUSAL IS THE SERVER'S. Nothing here validates the order fields to
 *      produce a missing-field list. The form posts what was typed — including
 *      nothing at all — and the 400 comes back as an `IngestRejection` carrying
 *      the server's own field names and its own reason. Both render verbatim.
 *      This is why the upload button is NEVER disabled: the design greys its
 *      "Continue" out until the form looks complete, which is a client-side
 *      completeness gate and would hide the one message the user needs.
 *   2. ACCEPTANCE IS EXPLICIT. Upload and accept are two calls. Uploading
 *      queues nothing; POST /api/orders/{id}/accept is a separate act by a
 *      person with the authority to take the package on. Nothing auto-accepts.
 *   3. DUPLICATE DETECTION IS THE SERVER'S (sha256). The 409 renders; nothing
 *      here hashes, compares or remembers a package.
 *
 * Nothing is inspected client-side to decide anything about the document. The
 * design's file card shows "64 pages · ✓ readable" — page count and readability
 * are pipeline determinations, so they are absent rather than guessed from the
 * File object. The name and byte size ARE local facts about the file just
 * picked, and are shown as that and nothing more.
 *
 * STILL ABSENT, deliberately rather than stubbed (see the InertPending blocks
 * below): client and product selection, the prior-effective-date an Update
 * needs, and the 2-step continuation into the abstractor sign-off. Rulings Q4
 * and Q5 — none of it exists in the contract or the data model.
 *
 * CONTRACT GAP (three, all on the same endpoints):
 *  - POST /api/orders answers with `{ order }` only. The design's file card
 *    wants the server's page count and its readability verdict; there is no
 *    field for either, so neither renders.
 *  - POST /api/orders/{id}/accept answers with a bare `Ack` — no updated order.
 *    So the accepted card states the consequence of the accepted call rather
 *    than re-reading `status`/`accepted_at`. It should return the Order (or the
 *    screen should re-read it) so the post-accept state is server state too.
 *  - Adding a document to a package AFTER ingest (the completeness gate's "adds,
 *    doesn't replace") has no endpoint and no defined package identity once the
 *    sha256 is no longer the whole package — ruling Q7. "Ingest another" starts
 *    a NEW order; it does not amend one.
 */

interface OrderFormValues {
  client_id: string;
  external_ref: string;
  jurisdiction: string;
  state: string;
  county: string;
}

/**
 * The five things the PDF cannot say, and why each one must arrive with it.
 * `label` is this screen's own name for its own input — the vocabulary of the
 * report header (CONTEXT §11) — not a translation of the server's field name,
 * which is always rendered beside it, verbatim, when the server names it as
 * missing. The door refuses cheaply so nothing fails expensively.
 */
const MANIFEST: {
  key: keyof OrderFormValues;
  label: string;
  why: string;
  hot?: boolean;
}[] = [
  {
    key: "external_ref",
    label: "ORDER #",
    why: "identity — nothing else ties this file to anything",
    hot: true,
  },
  {
    key: "client_id",
    label: "CLIENT",
    why: "decides delivery and which report shape renders",
  },
  {
    key: "jurisdiction",
    label: "JURISDICTION",
    why: "decides which extraction setup reads this county's documents",
  },
  {
    key: "state",
    label: "STATE",
    why: "some house rules apply only in certain states — the state picks them",
  },
  {
    key: "county",
    label: "COUNTY",
    why: "follow the land — property/recording county, never the notary's",
  },
];

/** This screen's own name for a field the SERVER named as missing. */
function describe(serverField: string): { label: string; why: string } {
  const meta = MANIFEST.find((m) => m.key === serverField);
  if (meta !== undefined) return { label: meta.label, why: meta.why };
  if (serverField === "package") {
    return {
      label: "THE PACKAGE",
      why: "the search package itself — there is nothing to extract without it",
    };
  }
  // A field the server requires that this form does not draw. Named, never
  // swallowed: the list is the server's and it renders whole.
  return { label: "—", why: "required by the order contract" };
}

/** The server's own words. Never paraphrased, never replaced by a toast. */
function serverSaid(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type Stage =
  | { kind: "compose" }
  | { kind: "uploaded"; order: Order; fileName: string }
  | { kind: "accepted"; order: Order };

export function IngestScreen() {
  const [stage, setStage] = useState<Stage>({ kind: "compose" });
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The server's refusal, parsed through the contract and held as it arrived. */
  const [rejection, setRejection] = useState<IngestRejection | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  /**
   * No resolver, deliberately. A zodResolver here would refuse the empty form
   * client-side and the reviewer would never see the server name what is
   * missing — the refusal IS the product requirement (CONTEXT §14), so the
   * form's job is to carry what was typed, not to judge it.
   */
  const { register, getValues, reset } = useForm<OrderFormValues>({
    defaultValues: {
      client_id: "",
      external_ref: "",
      jurisdiction: "",
      state: "",
      county: "",
    },
  });

  const upload = useMutation({
    mutationFn: (form: FormData) =>
      api(CreateOrderResponse, "/api/orders", { method: "POST", body: form }),
    onSuccess: (res) => {
      setBanner(null);
      setRejection(null);
      setStage({
        kind: "uploaded",
        order: res.order,
        fileName: file?.name ?? "the package",
      });
    },
    onError: (e: unknown) => {
      // A refusal is a typed ANSWER, not a transport failure: the 400 body is
      // the server's list of what it needs. Parse it through the contract and
      // render it; do not reconstruct it, and do not fall back to a generic
      // message when it parses.
      const refused =
        e instanceof ApiError && e.status === 400
          ? IngestRejection.safeParse(e.body)
          : null;
      if (refused?.success === true) {
        setBanner(null);
        setRejection(refused.data);
        return;
      }
      // Everything else — the sha256 duplicate 409 among them — is the
      // server's sentence, shown as the server's sentence.
      setRejection(null);
      setBanner(serverSaid(e));
    },
  });

  const accept = useMutation({
    mutationFn: (order: Order) =>
      api(Ack, `/api/orders/${order.id}/accept`, { method: "POST" }),
    onSuccess: (_ack, order) => {
      setBanner(null);
      setStage({ kind: "accepted", order });
    },
    onError: (e: unknown) => setBanner(serverSaid(e)),
  });

  const submit = () => {
    // Post what was typed, blanks included. The server names what is missing.
    const form = new FormData();
    for (const [key, value] of Object.entries(getValues())) {
      form.append(key, value.trim());
    }
    if (file !== null) form.append("package", file);
    upload.mutate(form);
  };

  const another = () => {
    setStage({ kind: "compose" });
    setRejection(null);
    setBanner(null);
    setFile(null);
    upload.reset();
    accept.reset();
    reset();
  };

  return (
    <ScreenFrame
      eyebrow="Step 1 — Upload"
      title="New title-search package"
      lede="One scanned PDF per order. Nothing leaves this tool as a deliverable until a reviewer has approved it, field by field."
      width="narrow"
    >
      {banner === null ? null : (
        <div
          data-testid="ingest-banner"
          className="mb-4 rounded-md border border-state-halt-border bg-state-halt-surface px-4 py-2.5 text-base leading-relaxed text-state-halt-ink"
        >
          server: {banner}
        </div>
      )}

      {stage.kind === "compose" ? (
        <>
          {/*
            The server's refusal, whole. The heading carries no message of its
            own — the reason below it is the server's sentence, and the rows are
            the server's field names in the server's order.
          */}
          {rejection === null ? null : (
            <div
              data-testid="refused-card"
              className="mb-4 rounded-lg border-2 border-state-halt bg-surface-panel px-5 py-4"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <Chip tone="halt">Refused</Chip>
                <span className="font-mono text-xs text-ink-muted">
                  {file?.name ?? "no file chosen"}
                </span>
              </div>
              <p className="mt-2 text-base leading-relaxed text-ink-secondary">
                {rejection.reason}
              </p>
              <div className="mt-3 text-micro font-bold tracking-badge text-ink-muted uppercase">
                Named by the server
              </div>
              <div className="mt-1">
                {rejection.missing_fields.map((name) => {
                  const meta = describe(name);
                  return (
                    <div
                      key={name}
                      data-testid="missing-field"
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-subtle py-2 last:border-b-0"
                    >
                      <span className="w-[120px] font-mono text-sm font-semibold text-state-halt-ink">
                        {name}
                      </span>
                      <span className="w-[110px] font-mono text-sm font-semibold text-ink-primary">
                        {meta.label}
                      </span>
                      <span className="min-w-[200px] flex-1 text-sm leading-relaxed text-ink-secondary">
                        {meta.why}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                Failing here costs a minute. A package missing its order
                identity that gets through fails four stages later, silently, as
                a wrong value on a delivered report.
              </p>
            </div>
          )}

          <label
            data-testid="drop-zone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              setFile(e.dataTransfer.files[0] ?? null);
            }}
            className={`block cursor-pointer rounded-lg border-2 border-dashed px-7 py-7 text-center ${
              dragging
                ? "border-page-ref bg-page-ref-surface"
                : "border-line-dashed bg-surface-panel"
            }`}
          >
            <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-md border-2 border-page-ref font-mono text-xl text-page-ref">
              PDF
            </div>
            <div className="font-semibold text-ink-primary">
              Drop the search package here
            </div>
            <div className="mt-1 text-xs text-ink-muted">
              or click to browse — one PDF, one order
            </div>
            <input
              type="file"
              accept="application/pdf"
              data-testid="package-input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-3 w-full text-xs text-ink-secondary"
            />
          </label>

          {file === null ? null : (
            <div className="mt-3.5">
              <Card testId="file-card">
                <CardBody>
                  <div className="font-mono text-md font-medium break-all text-ink-primary">
                    {file.name}
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    {file.size} bytes · chosen on this machine, not yet read
                  </div>
                  {/*
                    The design shows "64 pages · ✓ readable" here. Both are
                    server determinations — a page count comes from
                    segmentation and readability from the extraction attempt —
                    so neither is claimed from the File object. Nothing in this
                    screen opens the PDF.
                  */}
                  <div className="mt-2 text-sm leading-relaxed text-ink-secondary">
                    Page count and readability are the server&rsquo;s
                    determination, made after upload. This screen does not open
                    the file.
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          <div className="mt-4">
            <Card>
              <CardHeader>The order — what the PDF cannot say</CardHeader>
              {MANIFEST.map((m) => (
                <div
                  key={m.key}
                  className="border-b border-line-subtle px-4 py-3 last:border-b-0"
                >
                  <div className="flex flex-wrap items-baseline gap-3">
                    <label
                      htmlFor={`order-${m.key}`}
                      className="w-[110px] font-mono text-sm font-semibold text-ink-primary"
                    >
                      {m.label}
                    </label>
                    <input
                      {...register(m.key)}
                      id={`order-${m.key}`}
                      data-testid={`order-${m.key}`}
                      className="min-w-[180px] flex-1 rounded-md border border-line-strong bg-surface-panel px-2 py-1.5 font-mono text-sm text-ink-primary"
                    />
                  </div>
                  <div
                    className={`mt-1.5 text-xs leading-relaxed ${
                      m.hot === true
                        ? "font-semibold text-ink-primary"
                        : "text-ink-secondary"
                    }`}
                  >
                    {m.why}
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/*
            RULE Q4 — open-rulings.md. The design draws a required client and a
            required product, and a product "sets the questions and the scope":
            the checklist, the search period, the completeness gate and the
            money. There is no product in the data model, no clients or products
            endpoint, and no effective-sign-off resolution. So the block is
            named and inert, with NO chips: a plausible-looking row of clients
            and products would be data this screen invented, and someone would
            reasonably read it as configuration.
          */}
          <div className="mt-4">
            <InertPending
              what="Client and product selection — and the prior search effective date an Update needs"
              ruling="Q4"
            >
              <div className="text-sm leading-relaxed text-ink-secondary">
                Clients and products are drawn in the design; neither exists in
                the API. Nothing is rendered in their place rather than a chip
                row that could be mistaken for real configuration.
              </div>
            </InertPending>
          </div>

          <button
            type="button"
            data-testid="upload-btn"
            // Never disabled on an incomplete form. The refusal is the server's
            // and it has to be reachable — see rule 1 in the header comment.
            disabled={upload.isPending}
            onClick={submit}
            className="mt-4 w-full rounded-md border border-page-ref bg-page-ref px-4 py-3 text-lg font-semibold text-ink-on-action disabled:opacity-50"
          >
            {upload.isPending ? "Uploading…" : "Upload the package"}
          </button>

          {/*
            RULE Q5. The design's next step is a 2-step continuation into the
            abstractor's intake sign-off — Y/N/NA lines answered before the
            pipeline runs, a required comment on every NO, a signature, and a
            config version frozen to the order. None of it exists in any backend
            document, and it is not the same thing as CONTEXT §13's Y/N block,
            which is EXTRACTED output rather than an asserted input. Naming it
            here, inert, is the whole of it — sign-off semantics are not guessed.
          */}
          <div className="mt-3">
            <InertPending
              what="Continue to sign-off — the abstractor's intake checklist, signed before the pipeline runs"
              ruling="Q5"
            />
          </div>
        </>
      ) : null}

      {stage.kind === "uploaded" ? (
        <Card testId="uploaded-card" edge="decide">
          <CardHeader>Uploaded — not yet accepted</CardHeader>
          <CardBody>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-md font-semibold text-ink-primary">
                {stage.order.external_ref}
              </span>
              <span className="text-sm text-ink-secondary">
                {stage.order.county} Co., {stage.order.state} ·{" "}
                {stage.fileName}
              </span>
              {/* the server's status word, verbatim — nothing derives it */}
              <Chip tone="neutral" testId="uploaded-status">
                {stage.order.status}
              </Chip>
            </div>
            <p className="mt-2 text-base leading-relaxed text-ink-secondary">
              On the dock, and no further. Nothing reaches a reviewer until
              someone signs for this package — uploading is not accepting, and
              the queue never gets it by default.
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="accept-btn"
                disabled={accept.isPending}
                onClick={() => accept.mutate(stage.order)}
                className="rounded-md border border-page-ref bg-page-ref px-4 py-2 text-md font-semibold text-ink-on-action disabled:opacity-50"
              >
                {accept.isPending ? "Signing…" : "Accept — sign for it"}
              </button>
              <span className="text-xs text-ink-muted">
                signed as the person this session belongs to
              </span>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {stage.kind === "accepted" ? (
        <Card testId="accepted-card" edge="settled">
          <CardBody>
            <div className="text-xl font-semibold text-ink-primary">
              Signed for. Order{" "}
              <span className="font-mono">{stage.order.external_ref}</span> is
              queued.
            </div>
            <p className="mt-2 text-base leading-relaxed text-ink-secondary">
              {stage.order.county} Co., {stage.order.state} — accepted and
              headed for extraction. The queue decides who sees it next; nobody
              picks it.
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-4 text-base font-semibold">
              <Link to="/queue" className="no-underline">
                Review queue →
              </Link>
              {/*
                A NEW order, not an amendment. Adding a document to a package
                that already exists is ruling Q7 — the package sha256 is
                currently the dedupe identity, so a mutable package needs an
                identity defined first.
              */}
              <button
                type="button"
                onClick={another}
                className="cursor-pointer border-none bg-transparent p-0 font-sans text-base font-semibold text-page-ref"
              >
                Ingest another
              </button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </ScreenFrame>
  );
}
