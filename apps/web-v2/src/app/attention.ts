import { queryOptions, useQuery } from "@tanstack/react-query";
import { ComplaintsResponse, EscalationsResponse } from "@titlepipe/contract";
import { get } from "../shared/api";

const complaints = queryOptions({
  queryKey: ["complaints"],
  queryFn: () => get("/api/complaints", ComplaintsResponse),
});

const escalations = queryOptions({
  queryKey: ["escalations"],
  queryFn: () => get("/api/escalations", EscalationsResponse),
});

export type Attention = "halt" | "attend" | null;

/**
 * ATTENTION SIGNALS ARE DOTS, NEVER COUNTS.
 *
 * A number on a navigator is a backlog to burn down, and a backlog to burn
 * down is a reason to resolve things quickly rather than correctly. A dot says
 * only "there is something here", which is the entire actionable content of the
 * number — you have to open it either way. The counts live on the hub, where
 * somebody has already decided to go and look.
 *
 * RED FOR A COMPLAINT, AMBER FOR A GAP. An unresolved complaint is a report
 * that already went out wrong: it is the only signal in the product that means
 * a client is holding a defect right now. An open escalation is a reviewer
 * blocked on a rule nobody has written — urgent, but nothing has shipped.
 * Those are different kinds of bad and the colours say which.
 */
export function useAttention(path: string): Attention {
  const complaintsResult = useQuery({ ...complaints, enabled: path === "/complaints" });
  const escalationsResult = useQuery({ ...escalations, enabled: path === "/escalations" });

  if (path === "/complaints") {
    const unresolved = complaintsResult.data?.complaints.some((c) => c.resolution === null);
    return unresolved === true ? "halt" : null;
  }
  if (path === "/escalations") {
    const open = escalationsResult.data?.escalations.some((e) => e.resolution === null);
    return open === true ? "attend" : null;
  }
  return null;
}
