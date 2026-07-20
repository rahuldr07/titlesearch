import { useQuery } from "@tanstack/react-query";
import {
  ComplaintsResponse,
  DeliveriesResponse,
  EscalationsResponse,
  QueueNextResponse,
  RulesResponse,
} from "@titlepipe/contract";
import { api } from "./api";
import { DOORS, type Door } from "./doors";
import { canAccess } from "./nav";
import { useSession } from "./session";

/**
 * The live attention layer, shared by the hub (Home.tsx) and the side rail
 * (components/SideRail.tsx). Amber pulls; quiet recedes — an open escalation, a
 * delivery stuck in transit, or a rule draft waiting at the engineer gate PULL
 * you to their screen. Signals are queried ONLY for doors in the session role's
 * world — neither surface fetches what its viewer isn't allowed to see.
 *
 * Query keys match the per-screen queries, so TanStack Query dedupes: opening
 * the rail on a screen that already loaded its own data costs no extra request.
 */

export type Tone = "attend" | "act" | "quiet";
export interface Signal {
  text: string;
  tone: Tone;
}

export function useDoorSignals(): {
  doors: Door[];
  signalOf: (to: string) => Signal | null;
  anyError: unknown;
} {
  const role = useSession((s) => s.role);
  const doors = DOORS.filter((d) => canAccess(role, d.to));
  const has = (to: string) => doors.some((d) => d.to === to);

  const queueQ = useQuery({
    queryKey: ["queue", "next"],
    queryFn: () => api(QueueNextResponse, "/api/queue/next"),
    enabled: has("/queue"),
  });
  const escQ = useQuery({
    queryKey: ["escalations"],
    queryFn: () => api(EscalationsResponse, "/api/escalations"),
    enabled: has("/escalations"),
  });
  const delQ = useQuery({
    queryKey: ["deliveries"],
    queryFn: () => api(DeliveriesResponse, "/api/deliveries"),
    enabled: has("/delivery"),
  });
  const compQ = useQuery({
    queryKey: ["complaints"],
    queryFn: () => api(ComplaintsResponse, "/api/complaints"),
    enabled: has("/complaints"),
  });
  const rulesQ = useQuery({
    queryKey: ["rules"],
    queryFn: () => api(RulesResponse, "/api/rules"),
    enabled: has("/account"),
  });

  const signalOf = (to: string): Signal | null => {
    switch (to) {
      case "/queue": {
        if (queueQ.data === undefined) return null;
        return queueQ.data.order
          ? {
              text: `waiting — ${queueQ.data.order.external_ref}`,
              tone: "attend",
            }
          : { text: "caught up", tone: "quiet" };
      }
      case "/escalations": {
        if (escQ.data === undefined) return null;
        const n = escQ.data.escalations.filter(
          (e) => e.resolution === null,
        ).length;
        return n > 0
          ? { text: `${n} open — rules gaps`, tone: "attend" }
          : {
              text: "empty — the same question is never asked twice",
              tone: "quiet",
            };
      }
      case "/delivery": {
        if (delQ.data === undefined) return null;
        const failed = delQ.data.deliveries.some(
          (d) => d.delivered_at === null,
        );
        return failed
          ? { text: "failed in transit — retryable", tone: "attend" }
          : { text: "clear", tone: "quiet" };
      }
      case "/complaints": {
        if (compQ.data === undefined) return null;
        const n = compQ.data.complaints.filter(
          (c) => c.resolution === null,
        ).length;
        return n > 0
          ? { text: `${n} unresolved`, tone: "act" }
          : { text: "none recorded", tone: "quiet" };
      }
      case "/account": {
        if (rulesQ.data === undefined) return null;
        const n = rulesQ.data.rules.filter(
          (r) => r.status === "pending",
        ).length;
        return n > 0
          ? {
              text: `${n} rule draft${n === 1 ? "" : "s"} pending the engineer gate`,
              tone: "attend",
            }
          : null;
      }
      default:
        return null;
    }
  };

  const anyError =
    queueQ.error ?? escQ.error ?? delQ.error ?? compQ.error ?? rulesQ.error;

  return { doors, signalOf, anyError };
}
