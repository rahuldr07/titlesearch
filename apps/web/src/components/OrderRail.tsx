import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { OrderTimelineResponse, type Field } from "@titlepipe/contract";
import { api } from "../api";

/**
 * The order's spine — states travel with you. An order isn't a screen; it's
 * a thread through screens (ingested → reviewed → escalated → delivered →
 * complained-about), and any screen showing the order shows the thread so
 * nobody ever asks "what happened to this order".
 *
 * The thread is SERVER-authored: GET /api/orders/{id}/timeline (the UI never
 * re-derives pipeline history — CONTEXT §7). The one live segment is review
 * progress, computed from the fields this screen is already rendering; the
 * timeline's own review event is replaced by it while the reviewer works.
 * Never rendered on typist screens — nothing may travel INTO blindness.
 */
const KIND_LINK: Record<string, "/escalations" | "/delivery" | "/complaints"> = {
  escalated: "/escalations",
  delivered: "/delivery",
  complaint: "/complaints",
};

export function OrderRail({
  orderId,
  fields,
}: {
  orderId: string;
  fields: Field[];
}) {
  const timelineQ = useQuery({
    queryKey: ["orders", orderId, "timeline"],
    queryFn: () =>
      api(OrderTimelineResponse, `/api/orders/${orderId}/timeline`),
  });

  const events = timelineQ.data?.events ?? [];
  if (events.length === 0) return null;

  const queued = fields.filter((f) => f.state === "needs_review").length;
  const resolved = fields.filter(
    (f) =>
      f.state === "corrected" ||
      f.state === "escalated" ||
      (f.state === "confirmed" && f.approved_by !== null),
  ).length;

  const seg = "flex items-baseline gap-[5px] whitespace-nowrap";
  const dot = <span className="text-line-strong">→</span>;

  return (
    <div
      data-testid="order-rail"
      className="flex flex-none flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line bg-surface-dim px-[18px] py-[5px] text-[11px] text-ink-secondary"
    >
      <span className={seg}>
        <span className="font-mono font-semibold text-ink">{orderId}</span>
      </span>
      {events.map((ev, i) => {
        const isLiveReview = ev.kind === "review" && fields.length > 0;
        const label = isLiveReview
          ? `review: ${resolved} touched · ${queued} still queued`
          : ev.label;
        const to = KIND_LINK[ev.kind];
        const tone = ev.attend
          ? ev.kind === "complaint"
            ? "font-semibold text-act"
            : "font-semibold text-attend"
          : ev.kind === "delivered"
            ? "font-semibold text-ok"
            : "text-ink-dim";
        return (
          <span key={`${ev.kind}-${ev.at}-${i}`} className={seg}>
            {dot}
            {to !== undefined ? (
              <Link to={to} title={ev.detail ?? undefined} className={`${tone} no-underline`}>
                {label}
              </Link>
            ) : (
              <span title={ev.detail ?? undefined} className={tone}>
                {label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
