import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AuditResponse,
  MePermissionsResponse,
  RulesResponse,
} from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";

/**
 * The confirm endpoint returns a bare ack with no contract schema, so this is
 * a local validator rather than a pretend import. It still goes through the
 * same boundary check — an unexpected body is a disagreement worth surfacing,
 * even when the expected body is trivial.
 */
const AckResponse: Validator<{ ok: true }> = {
  safeParse: (input) =>
    typeof input === "object" && input !== null && (input as { ok?: unknown }).ok === true
      ? { success: true, data: { ok: true } }
      : { success: false, error: { message: "expected { ok: true }" } },
};

/**
 * The account layer's data. All three are read-only except the engineer gate.
 *
 * `me/permissions` is keyed on the acting role so switching role REFETCHES
 * rather than serving a cached world — `authz.spec` #4 asserts the Me tab
 * re-fetches on a role switch, because a stale world is worse than none: it
 * shows someone doors they no longer hold.
 */
export const rulesQuery = queryOptions({
  queryKey: ["rules"],
  queryFn: () => get("/api/rules", RulesResponse),
});

export const auditQuery = queryOptions({
  queryKey: ["audit"],
  queryFn: () => get("/api/audit", AuditResponse),
});

export function myWorldQuery(role: string) {
  return queryOptions({
    queryKey: ["me", "permissions", role],
    queryFn: () => get("/api/me/permissions", MePermissionsResponse),
  });
}

/**
 * THE ENGINEER GATE. A PENDING rule cannot affect the pipeline until an
 * engineer confirms it, and only an engineer may — the server refuses anyone
 * else (`authz.spec` #5, `account.spec` #2). The UI hides the affordance from
 * non-holders as well, but the hiding is courtesy; the refusal is the rule.
 */
export function useConfirmRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => post(`/api/rules/${ruleId}/confirm`, AckResponse, {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["rules"] }),
  });
}
