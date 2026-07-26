import { useMutation } from "@tanstack/react-query";
import { PassOrderRequest, PassOrderResponse } from "@titlepipe/contract";
import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { canDo } from "@titlepipe/contract";
import { session } from "../../session";
import { isTypingTarget } from "./keys";

/**
 * Pass the order — "this one is not for me".
 *
 * A PASS REQUIRES A STATED REASON (orphan rule O1). This is written down
 * nowhere: CONTEXT §7 and master §4.2 say only that passes are recorded and
 * that the 4th auto-escalates. The requirement survives solely in the harvested
 * specs, and it is what makes the 4th-pass escalation useful — a bare pass count
 * tells a senior that an order is hard but not what makes it hard, which is
 * exactly the information the escalation exists to capture.
 *
 * The 4th-pass auto-escalation is entirely SERVER-side. This component calls and
 * moves on; it does not count passes, does not know the threshold, and does not
 * decide when an escalation fires (constraint 9). The response is a bare ack —
 * pass counts never come back to the client.
 */
export function PassOrder({ orderId }: { orderId: string }) {
  /*
   * Absent, not disabled (orphan O13). Passing an order is a reviewer's act;
   * senior/ops/engineer arrive here by deep link for context and must not see a
   * control they cannot use — a greyed-out button advertises a capability the
   * role does not hold.
   */
  const mayPass = canDo(session.role, "order.pass");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [nudge, setNudge] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pass = useMutation({
    mutationFn: async (r: string) =>
      api(PassOrderResponse, `/api/orders/${orderId}/pass`, {
        method: "POST",
        body: JSON.stringify(PassOrderRequest.parse({ reason: r })),
      }),
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setOpen(false);
        setNudge(null);
        return;
      }
      if (isTypingTarget(e.target)) return; // O15
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        setNudge(null);
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    if (!reason.trim()) {
      setNudge("A pass needs its why — a pass needs its why to be worth anything.");
      return;
    }
    setNudge(null);
    pass.mutate(reason, {
      onSuccess: () => {
        setOpen(false);
        setReason("");
      },
    });
  };

  if (!mayPass) return null;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="act-pass"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-line-strong bg-surface-panel px-3 py-1.5 text-sm font-semibold text-ink-secondary"
      >
        Pass — say why
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-line-strong bg-surface-panel p-3 shadow-menu">
          <label className="block text-micro font-bold tracking-badge text-ink-muted uppercase">
            Why are you passing? — required
          </label>
          <input
            ref={inputRef}
            data-testid="pass-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="why are you passing this order?"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="mt-1 w-full rounded-sm border border-line-strong bg-surface-panel px-2 py-1.5 text-sm text-ink-primary"
          />
          {nudge !== null ? (
            <div
              data-testid="nudge"
              className="mt-2 rounded-md border border-state-attend-border bg-state-attend-surface px-2 py-1.5 text-sm text-state-attend-ink"
            >
              {nudge}
            </div>
          ) : null}
          <div className="mt-2 text-tiny leading-relaxed text-ink-muted">
            Recorded against the order. Repeated passes are escalated by the
            server, not by this screen.
          </div>
        </div>
      ) : null}
    </div>
  );
}
