import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ack,
  ComplaintsResponse,
  DeliveriesResponse,
  OrderFieldsResponse,
  type Complaint,
  type Field,
} from "@titlepipe/contract";
import { api } from "../api";
import { naText } from "../components/field";
import { MutationNote } from "../components/notice";
import { ScreenFrame, TopBar } from "../components/TopBar";
import { Tabs } from "./Delivery";

/**
 * Complaints (frontend-master-prompt §4.8), per the Delivery.dc.html
 * complaints tab: per-field capture, list GROUPED BY how_it_got_through —
 * the grouping is the finding, not the date. The contract enum carries two
 * groups (auto_confirmed | human_confirmed); auto_confirmed renders visually
 * distinct because it means NO HUMAN SAW IT — a threshold failure, and only
 * this list can say so.
 *
 * CONTRACT GAPs (not built): complaint-resolve endpoint (rule + golden-case
 * offer flow — resolution renders from entity data only), complaints-per-100
 * trend metric.
 */
export function ComplaintsScreen() {
  const complaintsQ = useQuery({
    queryKey: ["complaints"],
    queryFn: () => api(ComplaintsResponse, "/api/complaints"),
  });

  const complaints = complaintsQ.data?.complaints ?? [];
  const groups: {
    key: Complaint["how_it_got_through"];
    title: string;
    meaning: string;
    chipClass: string;
  }[] = [
    {
      key: "auto_confirmed",
      title: "AUTO-CONFIRMED — NO HUMAN SAW IT",
      meaning:
        "the threshold is wrong — a settings failure, and only this list can say so",
      chipClass:
        "rounded-chip border-[1.5px] border-act bg-card px-[7px] py-px text-[10px] font-bold tracking-[.06em] text-act",
    },
    {
      key: "human_confirmed",
      title: "CONFIRMED BY A REVIEWER",
      meaning: "a rule is missing, or training is — never a name",
      chipClass:
        "rounded-chip border border-ok-border bg-ok-bg px-[7px] py-px text-[10px] font-bold tracking-[.06em] text-ok",
    },
  ];

  return (
    <ScreenFrame>
      <TopBar
        title="Delivery & complaints"
        links={[
          { label: "Review", to: "/queue" },
          { label: "Readout", to: "/dashboard" },
          { label: "Inbox", to: "/escalations" },
        ]}
      >
        <Tabs active="complaints" />
      </TopBar>
      <div className="flex-1 overflow-y-auto px-[22px] pt-[18px] pb-[60px]">
        <div className="mx-auto max-w-[1060px]">
          <CaptureCard />
          <div className="mt-[18px] mb-2 text-[11px] font-bold tracking-[.08em] text-label">
            GROUPED BY HOW IT GOT THROUGH — THE GROUPING IS THE FINDING, NOT
            THE DATE
          </div>
          {complaintsQ.isPending && (
            <p className="text-[13px] text-ink-dim">Fetching complaints…</p>
          )}
          {complaintsQ.error != null && (
            <p className="text-[13px] text-act">
              Complaints unavailable: {String(complaintsQ.error)}
            </p>
          )}
          {groups.map((g) => {
            const items = complaints.filter(
              (c) => c.how_it_got_through === g.key,
            );
            return (
              <div key={g.key} className="mb-[14px]">
                <div className="flex flex-wrap items-baseline gap-[10px]">
                  <span className={g.chipClass} data-testid={`group-${g.key}`}>
                    {g.title}
                  </span>
                  <span className="text-[11.5px] text-ink-secondary">
                    {g.meaning}
                  </span>
                </div>
                {items.map((c) => (
                  <ComplaintCard key={c.id} complaint={c} />
                ))}
                {items.length === 0 && (
                  <div className="px-[2px] py-[6px] text-[11.5px] text-ink-faint">
                    none recorded — silence is only good if catching holds
                  </div>
                )}
              </div>
            );
          })}
          <div className="rounded-[5px] border border-line-mid bg-surface-dim px-[14px] py-[10px] text-[11.5px] leading-[1.55] text-ink-secondary">
            No per-reviewer complaint counts exist here, for anyone. A
            complaint traced to a reviewer teaches reviewers to escalate
            everything, or nothing. And there is no “disputed” state: even a
            wrong complaint means the report was unclear.
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

/** Chip for how a shipped value got through review, from server field state. */
function provenanceChip(f: Field): { label: string; className: string } {
  const base =
    "rounded-chip px-[6px] py-px text-[9.5px] font-bold tracking-[.06em] whitespace-nowrap ";
  if (f.state === "auto_confirmed")
    return {
      label: `AUTO-CONFIRMED${f.engine_confidence_raw !== null ? ` ${f.engine_confidence_raw.toFixed(2)}` : ""}`,
      className: base + "border border-act-border bg-act-bg text-act",
    };
  if (f.state === "corrected")
    return {
      label: "CORRECTED IN REVIEW",
      className: base + "border border-attend-border bg-attend-bg text-attend",
    };
  if (f.state === "escalated")
    return {
      label: "ESCALATED",
      className: base + "border border-neutral-border bg-neutral-bg text-neutral",
    };
  return {
    label: "CONFIRMED BY REVIEWER",
    className: base + "border border-ok-border bg-ok-bg text-ok",
  };
}

function CaptureCard() {
  const queryClient = useQueryClient();
  // Complaints are filed against DELIVERED orders — the choices come from the
  // deliveries list, not a hardcoded id and not a browse-all-orders endpoint
  // (which deliberately doesn't exist).
  const deliveriesQ = useQuery({
    queryKey: ["deliveries"],
    queryFn: () => api(DeliveriesResponse, "/api/deliveries"),
  });
  const deliveredIds = [
    ...new Set(
      (deliveriesQ.data?.deliveries ?? [])
        .map((d) => d.report?.order_id)
        .filter((id): id is string => id !== undefined && id !== null),
    ),
  ];
  const [chosenOrder, setChosenOrder] = useState<string | null>(null);
  const orderId = chosenOrder ?? deliveredIds[0] ?? null;
  const fieldsQ = useQuery({
    queryKey: ["orders", orderId, "fields"],
    queryFn: () => api(OrderFieldsResponse, `/api/orders/${orderId}/fields`),
    enabled: orderId !== null,
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [should, setShould] = useState("");
  const [words, setWords] = useState("");

  const record = useMutation({
    mutationFn: (v: { field_path: string; order_id: string }) =>
      api(Ack, "/api/complaints", {
        method: "POST",
        body: JSON.stringify({
          order_id: v.order_id,
          field_path: v.field_path,
          client_value: should.trim() === "" ? null : should.trim(),
          description: words.trim(),
        }),
      }),
    onSuccess: () => {
      setPicked(null);
      setShould("");
      setWords("");
      void queryClient.invalidateQueries({ queryKey: ["complaints"] });
    },
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: ["complaints"] }),
  });

  const fields = fieldsQ.data?.fields ?? [];
  const pickedField = fields.find((f) => f.path === picked) ?? null;
  const canRecord =
    orderId !== null &&
    pickedField !== null &&
    should.trim() !== "" &&
    words.trim() !== "";

  return (
    <div className="rounded-card border border-line-mid bg-input px-[18px] py-[14px]">
      <div className="text-[11px] font-bold tracking-[.08em] text-label">
        RECORD ONE — AGAINST THE FIELD, NOT THE ORDER. UNDER A MINUTE.
      </div>
      <div className="mt-[10px] grid grid-cols-[minmax(260px,1fr)_minmax(300px,1.2fr)] gap-4">
        <div>
          {(deliveriesQ.error ?? fieldsQ.error) != null && (
            <p className="mb-[6px] text-[11.5px] text-act">
              Capture sources unavailable:{" "}
              {String(deliveriesQ.error ?? fieldsQ.error)}
            </p>
          )}
          <div className="mb-[6px] flex flex-wrap items-baseline gap-2 text-[11px] text-ink-dim">
            <span>delivered report ·</span>
            {deliveredIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setChosenOrder(id);
                  setPicked(null);
                }}
                className={`cursor-pointer rounded-chip border px-[7px] py-px font-mono text-[10.5px] ${
                  id === orderId
                    ? "border-action bg-action-bg text-action"
                    : "border-line-mid bg-transparent text-ink-secondary"
                }`}
              >
                {id}
              </button>
            ))}
            <span>· click the field the client is talking about</span>
          </div>
          {fields.map((f) => {
            const chip = provenanceChip(f);
            return (
              <div
                key={f.id}
                data-testid={`cap-${f.path}`}
                onClick={() => setPicked(f.path)}
                className={`grid cursor-pointer grid-cols-[minmax(120px,1.3fr)_minmax(70px,1fr)_auto] items-baseline gap-[10px] rounded-btn border px-[9px] py-[6px] ${
                  picked === f.path
                    ? "border-action bg-sel-bg"
                    : "border-transparent"
                }`}
              >
                <span className="truncate font-mono text-[11.5px]">{f.path}</span>
                {/* §0.3: pending must never read "Not Available" */}
                <span className="truncate font-mono text-[11.5px] text-ink-secondary">
                  {naText(f.value, f.na_reason, f.state)}
                </span>
                <span className={chip.className}>{chip.label}</span>
              </div>
            );
          })}
        </div>
        <div>
          {pickedField ? (
            <>
              <div className="text-[12px] text-ink-secondary">
                <b>shipped:</b>{" "}
                <span className="font-mono">
                  {naText(
                    pickedField.value,
                    pickedField.na_reason,
                    pickedField.state,
                  )}
                </span>{" "}
                · <b>how it shipped:</b> {provenanceChip(pickedField).label}
              </div>
              <input
                data-testid="cap-should"
                value={should}
                onChange={(e) => setShould(e.target.value)}
                placeholder="what the client says it should be"
                className="mt-2 w-full rounded-btn border border-line-strong bg-card px-[10px] py-[7px] font-mono text-[12.5px]"
              />
              <input
                data-testid="cap-words"
                value={words}
                onChange={(e) => setWords(e.target.value)}
                placeholder="their words, verbatim — “…”"
                className="mt-2 w-full rounded-btn border border-line-strong bg-card px-[10px] py-[7px] font-sans text-[12.5px]"
              />
              <div className="mt-[10px] flex items-center gap-3">
                <button
                  type="button"
                  data-testid="cap-record"
                  disabled={!canRecord || record.isPending}
                  onClick={() => {
                    if (orderId !== null && pickedField !== null) {
                      record.mutate({
                        field_path: pickedField.path,
                        order_id: orderId,
                      });
                    }
                  }}
                  className={`rounded-btn px-[14px] py-[6px] font-sans text-[12px] font-semibold ${
                    canRecord
                      ? "cursor-pointer border border-action bg-action text-ink-invert"
                      : "cursor-not-allowed border-[1.5px] border-dashed border-dash bg-track text-ink-dim"
                  }`}
                >
                  Record — it lands in its “how it got through” group
                </button>
                <span className="text-[11px] text-ink-dim">
                  two states only: recorded, resolved
                </span>
              </div>
              {record.error != null && (
                <MutationNote testid="record-note" error={record.error} />
              )}
            </>
          ) : (
            <div className="rounded-card border-[1.5px] border-dashed border-line-strong px-5 py-6 text-center text-[12px] text-ink-faint">
              pick a field on the left — the shipped value and its provenance
              fill in automatically
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComplaintCard({ complaint }: { complaint: Complaint }) {
  const resolved = complaint.resolution !== null;
  if (resolved) {
    return (
      <div className="mt-[7px] rounded-[5px] border border-line-mid bg-surface-dim px-[14px] py-[9px]">
        <div className="flex flex-wrap items-baseline gap-[10px]">
          <span className="text-[12px] font-bold text-ok">✓ resolved</span>
          <span className="font-mono text-[12px]">{complaint.field_path}</span>
          <span className="text-[12px] text-ink-secondary">
            {complaint.resolution}
          </span>
          {complaint.golden_offer_accepted === true && (
            <span className="rounded-chip border border-ok-border bg-ok-bg px-[6px] py-px text-[9.5px] font-bold text-ok">
              GOLDEN CASE
            </span>
          )}
        </div>
      </div>
    );
  }
  const auto = complaint.how_it_got_through === "auto_confirmed";
  return (
    <div
      data-testid={`complaint-${complaint.field_path}`}
      className="mt-[7px] rounded-card border border-line-mid bg-card px-4 py-[13px]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-[10px]">
          {/* Context-carrying navigation: the retro opens on the exact field. */}
          <Link
            to="/orders/$orderId/review"
            params={{ orderId: complaint.order_id }}
            search={{ field: complaint.field_path }}
            data-testid={`complaint-open-${complaint.field_path}`}
            className="font-mono text-[12.5px] font-semibold text-action no-underline hover:underline"
          >
            {complaint.field_path}
          </Link>
          <span className="text-[12px] text-ink-secondary">
            order {complaint.order_id}
          </span>
        </div>
      </div>
      <div className="mt-[6px] text-[12.5px]">
        <span className="text-ink-dim">shipped</span>{" "}
        {/* Complaint carries no state/na_reason — the NA split here needs a
            contract change (CONTRACT GAP), not a UI one */}
        <b className="font-mono">{complaint.shipped_value ?? "Not Available"}</b>{" "}
        · <span className="text-ink-dim">client says</span>{" "}
        <b className="font-mono">{complaint.client_value ?? "—"}</b>
      </div>
      {auto && (
        <div className="mt-2 rounded-btn border border-act-border bg-act-bg px-[10px] py-[7px] text-[12px] font-semibold text-act">
          Auto-confirmed — no human ever saw it. Not a reviewer failure; a
          settings failure. Nothing else in the system can tell you the
          threshold is wrong.
        </div>
      )}
    </div>
  );
}
