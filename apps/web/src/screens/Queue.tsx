import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import {
  PassOrderResponse,
  QueueNextResponse,
  type Order,
} from "@titlepipe/contract";
import { api } from "../api";
import { MutationNote } from "../components/notice";
import { ScreenFrame, TopBar } from "../components/TopBar";

/**
 * Reviewer queue, to the .dc.html pixel spec — pruned to the product laws
 * (frontend-master-prompt §4.1): a SINGLE next-order card from
 * GET /api/queue/next. No waiting list, no stuck list, no order counts, no
 * time estimates — the .dc.html's list sections violate §0.4 (queue browsing,
 * pace indicators) and are deliberately not ported. Next decides; you don't
 * shop. Pass is cheap and recorded; the 4th pass auto-escalates server-side.
 */
export function QueueScreen() {
  const { data, isPending, error } = useQuery({
    queryKey: ["queue", "next"],
    queryFn: () => api(QueueNextResponse, "/api/queue/next"),
  });

  return (
    <ScreenFrame>
      <TopBar
        title="Review queue"
        links={[
          { label: "Escalation inbox", to: "/escalations" },
          { label: "Readout", to: "/dashboard" },
        ]}
      />
      <div className="flex-1 overflow-y-auto px-[22px] pt-[18px] pb-[60px]">
        <div className="mx-auto w-full max-w-[1014px]">
          {isPending && (
            <p className="text-[13px] text-ink-dim">Fetching next order…</p>
          )}
          {error != null && (
            <p className="text-[13px] text-act">
              Queue unavailable: {String(error)}
            </p>
          )}
          {data &&
            (data.order ? (
              <NextOrderCard order={data.order} />
            ) : (
              <CaughtUpCard />
            ))}
        </div>
      </div>
    </ScreenFrame>
  );
}

/** Elapsed-since formatting mirrors the .dc.html: hours to one decimal, days past 48 h. */
function elapsedSince(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h >= 48) return `${Math.round(h / 24)} d`;
  return `${Math.round(h * 10) / 10} h`;
}

function NextOrderCard({ order }: { order: Order }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [passing, setPassing] = useState(false);
  const [passNudge, setPassNudge] = useState(false);
  const [passedNote, setPassedNote] = useState<string | null>(null);

  const pass = useMutation({
    mutationFn: (reason: string) =>
      api(PassOrderResponse, `/api/orders/${order.id}/pass`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }).then(() => reason),
    onSuccess: (reason) => {
      setPassing(false);
      setPassedNote(
        `passed ${order.external_ref} — “${reason}” · recorded (4 passes auto-raises an escalation)`,
      );
      void queryClient.invalidateQueries({ queryKey: ["queue", "next"] });
    },
  });

  const startReview = () => {
    void navigate({
      to: "/orders/$orderId/review",
      params: { orderId: order.id },
    });
  };

  // preventDefault matters: without it the "p" keystroke lands inside the
  // freshly-focused pass input (the .dc.html prototype preventDefault()s too).
  useHotkeys("enter", startReview, { enabled: !passing, preventDefault: true }, [
    order.id,
    passing,
  ]);
  useHotkeys("p", () => setPassing(true), { enabled: !passing, preventDefault: true }, [
    passing,
  ]);

  return (
    <div className="rounded-card border border-line-strong bg-card px-5 py-[18px] shadow-card">
      <div className="flex flex-wrap items-center gap-[22px]">
        <button
          type="button"
          onClick={startReview}
          className="flex cursor-pointer items-center gap-3 rounded-[6px] border border-action bg-action px-[34px] py-4 font-sans text-[17px] font-bold text-ink-invert hover:bg-action-hover"
        >
          Next order
          <span className="rounded-chip bg-btn-key px-[7px] py-px font-mono text-[12px]">
            ⏎
          </span>
        </button>
        <div className="min-w-[300px] flex-1">
          <div className="flex flex-wrap items-baseline gap-[10px]">
            <span
              data-testid="order-ref"
              className="font-mono text-[15px] font-semibold"
            >
              {order.external_ref}
            </span>
            <span className="text-[12.5px] text-ink-secondary">
              {order.county} Co. · {order.state}
            </span>
            <span className="rounded-chip border border-action-border bg-action-bg px-[7px] py-px text-[10.5px] font-bold tracking-[.05em] text-action uppercase">
              {order.jurisdiction}
            </span>
          </div>
          <div className="mt-[7px] flex flex-wrap items-center gap-4 text-[12.5px] text-ink-body">
            <span className="font-semibold">
              waiting {elapsedSince(order.arrived_at)}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-[14px] border-t border-hairline pt-[10px]">
        {!passing && (
          <div className="flex flex-wrap items-baseline gap-[10px]">
            <button
              type="button"
              onClick={() => setPassing(true)}
              className="cursor-pointer rounded-btn border border-line-strong bg-transparent px-[14px] py-[5px] font-sans text-[12.5px] font-semibold text-ink-secondary"
            >
              Pass — say why
              <span className="ml-2 rounded-chip bg-line-light px-[5px] font-mono text-[10.5px]">
                P
              </span>
            </button>
            <span className="text-[11px] text-ink-dim">
              passes are cheap and recorded — an order passed by 4 people goes
              to the escalation inbox as a rules gap
            </span>
          </div>
        )}
        {passing && (
          <div className="flex max-w-[560px] flex-col gap-[5px]">
            <input
              autoFocus
              placeholder="One line — why are you passing? e.g. “never done a Cobb Co. tax card”"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const reason = e.currentTarget.value.trim();
                  // Refusal (§0.5-adjacent): an empty reason never submits —
                  // and the refusal says so; silence reads as a broken key.
                  if (reason) pass.mutate(reason);
                  else setPassNudge(true);
                } else if (e.key === "Escape") {
                  setPassing(false);
                  setPassNudge(false);
                }
              }}
              className="w-full rounded-btn border border-dash bg-input px-[10px] py-2 font-sans text-[13px]"
            />
            {passNudge ? (
              <div data-testid="nudge" className="text-[11px] font-semibold text-attend">
                held — a pass needs its why, one line.
              </div>
            ) : (
              <div className="text-[11px] text-ink-dim">
                ⏎ pass · esc keep it · recorded against the order, not against
                you
              </div>
            )}
            {pass.error != null && (
              <MutationNote testid="pass-note" error={pass.error} />
            )}
          </div>
        )}
        {passedNote && !passing && (
          <div data-testid="passed-note" className="mt-[6px] text-[11.5px] text-attend">
            ↷ {passedNote}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Queue-empty state. The .dc.html distinguishes "caught up" from "nothing is
 * arriving" (intake stopped) — that split needs intake telemetry the contract
 * does not carry (see CONTRACT GAP notes), so only the quiet state renders.
 */
function CaughtUpCard() {
  return (
    <div className="rounded-card border border-line-mid bg-card px-8 py-[34px]">
      <div className="text-[16px] font-semibold">Caught up.</div>
      <div className="mt-2 max-w-[520px] text-[13px] leading-[1.55] text-ink-secondary">
        Nothing queued for you right now. Your open escalations stay in the
        escalation inbox; the rest is not your problem yet.
      </div>
    </div>
  );
}
