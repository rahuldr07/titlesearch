import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import {
  Ack,
  CreateOrderResponse,
  IngestRejection,
  type Order,
} from "@titlepipe/contract";
import { api } from "../api";
import { ScreenFrame, TopBar } from "../components/TopBar";

/**
 * Ingest (frontend-master-prompt §4.3), to the Ingest.dc.html pixel spec:
 * order create + package upload; a rejection renders the SERVER's named
 * missing fields verbatim; duplicate (sha256) surfaces as a notice; accept is
 * EXPLICIT — nothing reaches a reviewer until someone signs for it.
 *
 * The .dc.html's splitter-review stage (documents found / unclassified pages
 * / split-is-right decisions) has no contract shape yet — CONTRACT GAP; that
 * stage is not built until a segmentation response schema exists.
 */

interface OrderFormValues {
  client_id: string;
  external_ref: string;
  jurisdiction: string;
  state: string;
  county: string;
}

/** Field → why it must exist. The door refuses cheaply so nothing fails expensively. */
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
    why: "the routing cell — engines are seated per jurisdiction × section",
  },
  {
    key: "state",
    label: "STATE",
    why: "rules carry jurisdiction scope (R15, R20 are state-law-dependent)",
  },
  {
    key: "county",
    label: "COUNTY",
    why: "follow the land — property/recording county, never the notary's",
  },
];

type Stage =
  | { kind: "form" }
  | { kind: "refused"; rejection: IngestRejection; fileName: string }
  | { kind: "accept"; order: Order; fileName: string }
  | { kind: "accepted"; order: Order };

class RefusedError extends Error {
  rejection: IngestRejection;
  constructor(rejection: IngestRejection) {
    super(rejection.reason);
    this.rejection = rejection;
  }
}

async function uploadPackage(form: FormData) {
  const res = await fetch("/api/orders", { method: "POST", body: form });
  const body: unknown = await res.json();
  if (res.status === 400) {
    const rejection = IngestRejection.safeParse(body);
    if (rejection.success) throw new RefusedError(rejection.data);
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `POST /api/orders → ${res.status}`;
    throw new Error(msg);
  }
  return CreateOrderResponse.parse(body);
}

export function IngestScreen() {
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [banner, setBanner] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
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
    mutationFn: (form: FormData) => uploadPackage(form),
    onSuccess: (res) => {
      setBanner(null);
      setStage({
        kind: "accept",
        order: res.order,
        fileName: file?.name ?? "package.pdf",
      });
    },
    onError: (e) => {
      if (e instanceof RefusedError) {
        setStage({
          kind: "refused",
          rejection: e.rejection,
          fileName: file?.name ?? "no file chosen",
        });
      } else {
        setBanner(`server: ${e.message}`);
      }
    },
  });

  const accept = useMutation({
    mutationFn: (order: Order) =>
      api(Ack, `/api/orders/${order.id}/accept`, { method: "POST" }),
    onSuccess: (_r, order) => setStage({ kind: "accepted", order }),
  });

  const submit = () => {
    // The SERVER names what's missing — the door here sends what it has.
    const fd = new FormData();
    const values = getValues();
    for (const [k, v] of Object.entries(values)) {
      if (v.trim() !== "") fd.append(k, v.trim());
    }
    if (file) fd.append("package", file);
    upload.mutate(fd);
  };

  const backToForm = () => {
    setStage({ kind: "form" });
    setBanner(null);
    setFile(null);
    reset();
  };

  return (
    <ScreenFrame>
      <TopBar
        title="Receiving — package intake"
        links={[
          { label: "Queue", to: "/queue" },
          { label: "Readout", to: "/dashboard" },
        ]}
      >
        <div className="text-[12px] text-ink-dim">
          check the manifest, sign for it, move it on
        </div>
      </TopBar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {stage.kind === "form" && (
          <div className="mx-auto max-w-[1080px] px-[22px] pt-[26px] pb-[60px]">
            {banner !== null && (
              <div
                data-testid="ingest-banner"
                className="mb-[14px] rounded-[5px] border border-attend-border bg-attend-bg px-[14px] py-[9px] text-[12.5px] text-attend-strong"
              >
                {banner}
              </div>
            )}
            <div className="grid grid-cols-[1fr_1.35fr] items-start gap-4">
              <div className="rounded-card border border-line-strong bg-card px-5 py-[18px]">
                <div className="text-[11px] font-bold tracking-[.1em] text-label">
                  THE PACKAGE
                </div>
                <div className="mt-3 rounded-card border-[1.5px] border-dashed border-dash px-5 py-[22px] text-center">
                  <div className="font-mono text-[13px] text-ink-secondary">
                    {file?.name ?? "no file chosen"}
                  </div>
                  <div className="mt-[6px] mb-3 text-[11.5px] text-ink-dim">
                    36–181 pages of scans · it cannot come alone — see the
                    manifest →
                  </div>
                  <input
                    type="file"
                    accept="application/pdf"
                    data-testid="package-input"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="max-w-full text-[12px]"
                  />
                </div>
                <div className="mt-[14px] flex flex-wrap items-center gap-[10px]">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={upload.isPending}
                    className="cursor-pointer rounded-btn border border-action bg-action px-4 py-[7px] font-sans text-[12.5px] font-semibold text-ink-invert"
                  >
                    {upload.isPending ? "uploading…" : "upload the package"}
                  </button>
                </div>
              </div>
              <div className="rounded-card border border-line-strong bg-card px-5 py-[18px]">
                <div className="text-[11px] font-bold tracking-[.1em] text-label">
                  THE ORDER — WHAT THE PDF CANNOT SAY
                </div>
                {MANIFEST.map((m) => (
                  <div
                    key={m.key}
                    className="grid grid-cols-[130px_150px_1fr] items-baseline gap-[10px] border-b border-hairline py-[6px]"
                  >
                    <span className="font-mono text-[12px] font-semibold">
                      {m.label}
                    </span>
                    <input
                      {...register(m.key)}
                      data-testid={`order-${m.key}`}
                      className="w-full rounded-[3px] border border-line-strong bg-input px-[7px] py-[3px] font-mono text-[11.5px]"
                    />
                    <span
                      className={`text-[12px] leading-[1.45] ${
                        m.hot === true
                          ? "font-semibold text-ink"
                          : "text-ink-secondary"
                      }`}
                    >
                      {m.why}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 max-w-[760px] text-[12px] leading-[1.55] text-ink-secondary">
              A package missing its order identity does not fail at upload. It
              fails four stages later, silently, as a wrong value on a
              delivered report. This door refuses cheaply so nothing fails
              expensively.
            </div>
          </div>
        )}

        {stage.kind === "refused" && (
          <div className="mx-auto max-w-[820px] px-[22px] pt-[26px] pb-[60px]">
            <div
              data-testid="refused-card"
              className="rounded-card border-2 border-act bg-card px-6 py-[22px]"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <div className="text-[16px] font-bold text-act">
                  Refused — a report cannot be produced from this file.
                </div>
                <span className="font-mono text-[12px] text-ink-dim">
                  {stage.fileName}
                </span>
              </div>
              <div className="mt-2 text-[12.5px] leading-[1.5] text-ink-body">
                {stage.rejection.reason}
              </div>
              {stage.rejection.missing_fields.map((fieldName) => {
                const meta = MANIFEST.find((m) => m.key === fieldName);
                return (
                  <div
                    key={fieldName}
                    data-testid="missing-field"
                    className="grid grid-cols-[170px_1fr] items-baseline gap-3 border-b border-act-bg py-[7px]"
                  >
                    <span className="font-mono text-[12px] font-semibold text-act">
                      {meta?.label ?? fieldName.toUpperCase()}
                    </span>
                    <span className="text-[12px] leading-[1.45] text-ink-secondary">
                      {meta?.why ??
                        (fieldName === "package"
                          ? "the search package itself — there is nothing to extract without it"
                          : "required by the order contract")}
                    </span>
                  </div>
                );
              })}
              <div className="mt-3 text-[12px] leading-[1.55] text-ink-secondary">
                This refusal is protection, not pedantry: failing here costs a
                minute; failing four stages from now costs a client.
              </div>
              <div className="mt-4 flex gap-[10px]">
                <button
                  type="button"
                  onClick={() => setStage({ kind: "form" })}
                  className="cursor-pointer rounded-btn border border-action bg-action px-[18px] py-2 font-sans text-[13px] font-semibold text-ink-invert"
                >
                  back — attach the order
                </button>
              </div>
            </div>
          </div>
        )}

        {stage.kind === "accept" && (
          <div className="mx-auto max-w-[620px] px-[22px] pt-[60px]">
            <div className="rounded-card border border-line-strong bg-card px-6 py-[22px]">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-[13.5px] font-semibold">
                  {stage.order.external_ref}
                </span>
                <span className="text-[12px] text-ink-secondary">
                  {stage.order.county} Co., {stage.order.state} ·{" "}
                  {stage.fileName}
                </span>
              </div>
              <div className="mt-2 text-[12.5px] leading-[1.55] text-ink-secondary">
                Uploaded and on the dock. The splitter's read of this package
                lands here when segmentation ships; acceptance stays yours
                either way.
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid="accept-btn"
                  onClick={() => accept.mutate(stage.order)}
                  disabled={accept.isPending}
                  className="cursor-pointer rounded-btn border border-action bg-action px-[18px] py-2 font-sans text-[13px] font-semibold text-ink-invert"
                >
                  Accept — sign for it
                </button>
                <span className="text-[11px] text-ink-dim">
                  nothing reaches a reviewer until someone says this is right
                </span>
              </div>
            </div>
          </div>
        )}

        {stage.kind === "accepted" && (
          <div className="mx-auto max-w-[620px] px-[22px] pt-[60px]">
            <div
              data-testid="accepted-card"
              className="rounded-card border border-line-mid bg-card px-7 py-[26px]"
            >
              <div className="text-[15px] font-semibold">
                Signed for. Order{" "}
                <span className="font-mono">{stage.order.external_ref}</span>{" "}
                is queued.
              </div>
              <div className="mt-2 text-[12.5px] leading-[1.55] text-ink-secondary">
                {stage.order.county} Co., {stage.order.state} — accepted and
                headed for extraction. The queue decides who sees it next.
              </div>
              <div className="mt-[14px] flex gap-4 text-[12.5px] font-semibold">
                <Link to="/queue" className="no-underline">
                  Review queue →
                </Link>
                <button
                  type="button"
                  onClick={backToForm}
                  className="cursor-pointer border-none bg-transparent p-0 font-sans text-[12.5px] font-semibold text-action"
                >
                  ingest another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScreenFrame>
  );
}
