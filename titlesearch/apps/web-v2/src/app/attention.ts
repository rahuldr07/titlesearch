import { queryOptions, useQuery } from "@tanstack/react-query";
import { EscalationsResponse } from "@titlepipe/contract";
import { get } from "../shared/api";

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
 * number — you have to open it either way. The count lives on the screen
 * itself, where somebody has already decided to go and look.
 *
 * AMBER FOR AN OPEN ESCALATION — a reviewer blocked on a rule nobody has
 * written. It is the one door in the flow that can be silently accumulating
 * work, because the person who is stuck is not the person who walks past it.
 */
export function useAttention(path: string): Attention {
  const escalationsResult = useQuery({ ...escalations, enabled: path === "/escalations" });

  if (path === "/escalations") {
    const open = escalationsResult.data?.escalations.some((e) => e.resolution === null);
    return open === true ? "attend" : null;
  }
  return null;
}
