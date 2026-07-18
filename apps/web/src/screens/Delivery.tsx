import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Ack,
  DeliveriesResponse,
  type DeliveryWithReport,
} from "@titlepipe/contract";
import { api } from "../api";
import { ScreenFrame, TopBar } from "../components/TopBar";

/**
 * Delivery (frontend-master-prompt §4.7), to the Delivery.dc.html pixel
 * spec: turnaround closes here. Timestamps on every send; v1 + v2 both
 * listed — the pair is the defect record. A FAILED delivery is a TRANSIT
 * state (attend, retryable) and is never styled as a quality failure (act).
 *
 * Not ported (CONTRACT GAPs): client/vendor names, arrived→delivered elapsed
 * breakdown (no order-event timeline shape), the Lookup tab (no order-events
 * endpoint).
 */
export function DeliveryScreen() {
  const deliveriesQ = useQuery({
    queryKey: ["deliveries"],
    queryFn: () => api(DeliveriesResponse, "/api/deliveries"),
  });

  /** Group by order so multiple report versions read as one defect record. */
  const groups = useMemo(() => {
    const byOrder = new Map<string, DeliveryWithReport[]>();
    for (const d of deliveriesQ.data?.deliveries ?? []) {
      const key = d.report?.order_id ?? d.report_id;
      const list = byOrder.get(key) ?? [];
      list.push(d);
      byOrder.set(key, list);
    }
    return [...byOrder.entries()].map(([orderId, rows]) => ({
      orderId,
      rows: rows.sort((a, b) => (a.report?.version ?? 0) - (b.report?.version ?? 0)),
    }));
  }, [deliveriesQ.data]);

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
        <Tabs active="deliveries" />
      </TopBar>
      <div className="flex-1 overflow-y-auto px-[22px] pt-[18px] pb-[60px]">
        <div className="mx-auto max-w-[1060px]">
          <div className="flex flex-wrap items-baseline justify-between gap-[10px]">
            <div className="text-[15px] font-bold">
              Delivered — turnaround closes here
            </div>
            <div className="text-[11.5px] text-ink-dim">
              method is per-client configuration — approval delivers; nobody
              picks a channel thirty times a day
            </div>
          </div>
          {groups.map((g) => (
            <OrderDeliveryCard key={g.orderId} orderId={g.orderId} rows={g.rows} />
          ))}
          <div className="mt-[10px] text-[11px] text-ink-faint">
            arrived → delivered has never been measured in this business —
            “too slow” is the premise of the whole project, and this list
            answers where the hours actually go
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

export function Tabs({ active }: { active: "deliveries" | "complaints" }) {
  const tab = (on: boolean) =>
    `px-[14px] py-[5px] text-[12px] font-semibold whitespace-nowrap no-underline ${
      on ? "bg-action text-ink-invert" : "bg-card text-ink-secondary"
    }`;
  return (
    <div className="flex overflow-hidden rounded-btn border border-line-strong">
      <Link to="/delivery" className={tab(active === "deliveries")}>
        Deliveries
      </Link>
      <Link to="/complaints" className={tab(active === "complaints")}>
        Complaints
      </Link>
    </div>
  );
}

const fmt = (iso: string | null) =>
  iso === null
    ? "—"
    : new Intl.DateTimeFormat("en-US", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(iso));

function OrderDeliveryCard({
  orderId,
  rows,
}: {
  orderId: string;
  rows: DeliveryWithReport[];
}) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: (id: string) =>
      api(Ack, `/api/deliveries/${id}/retry`, { method: "POST" }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["deliveries"] }),
  });

  const latest = rows[rows.length - 1];
  if (!latest) return null;
  const failed = latest.delivered_at === null;
  const chip =
    "rounded-chip px-[7px] py-px text-[9.5px] font-bold tracking-[.06em] whitespace-nowrap uppercase";

  return (
    <div
      data-testid={`delivery-${orderId}`}
      className={`mt-[10px] rounded-card bg-card px-4 py-[13px] ${
        failed ? "border-[1.5px] border-attend-border" : "border border-line-mid"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-[13.5px] font-semibold">{orderId}</span>
          <span className={`${chip} border border-line-strong bg-surface-dim text-ink-secondary`}>
            {latest.method}
          </span>
          <span
            data-testid="delivery-status"
            className={`${chip} ${
              failed
                ? "border border-attend-border bg-attend-bg text-attend"
                : "border border-ok-border bg-ok-bg text-ok"
            }`}
          >
            {failed
              ? "FAILED IN TRANSIT"
              : rows.length > 1
                ? `DELIVERED · ${rows.length} VERSIONS`
                : "DELIVERED"}
          </span>
        </div>
        <span className="text-[12.5px] font-bold tabular-nums">
          attempted {fmt(latest.attempted_at)}
          {latest.delivered_at !== null && ` → delivered ${fmt(latest.delivered_at)}`}
        </span>
      </div>
      {rows.map((d) => (
        <div
          key={d.id}
          className="flex flex-wrap items-baseline gap-3 pt-[5px] text-[12px]"
        >
          <span className="font-mono font-semibold text-ink-body">
            v{d.report?.version ?? "?"}
          </span>
          <span className="text-ink-secondary">
            {d.delivered_at !== null
              ? `delivered ${fmt(d.delivered_at)}`
              : "rendered, undelivered · will not be re-rendered — retry sends the same file"}
            {d.report ? ` · shape ${d.report.shape}` : ""}
          </span>
          {d.evidence !== null && d.report?.version === 2 && (
            <span className="rounded-chip border border-attend-border bg-attend-bg px-[7px] py-px text-[11px] text-attend">
              {d.evidence} — defect record
            </span>
          )}
          {d.evidence !== null && d.report?.version !== 2 && (
            <span className="text-ink-dim">{d.evidence}</span>
          )}
        </div>
      ))}
      {failed && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="retry-btn"
            onClick={() => retry.mutate(latest.id)}
            disabled={retry.isPending}
            className="cursor-pointer rounded-btn border border-action bg-action px-[14px] py-[5px] font-sans text-[12px] font-semibold text-ink-invert"
          >
            Retry send
          </button>
          <span className="text-[11.5px] text-ink-secondary">
            the work is correct and stuck in transit — this is not a quality
            problem and must not be treated as one
          </span>
        </div>
      )}
    </div>
  );
}
