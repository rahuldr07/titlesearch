import { useQuery } from "@tanstack/react-query";
import { MePermissionsResponse, type GrantedPermissionSchema } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { useSession } from "../../shared/session";

/**
 * Rules as data. The client renders the permissions it receives and never
 * re-derives one — calling the contract's `canAccess`/`rulesFor` here would
 * be a second evaluation of the table in the browser, drifting from the
 * first exactly when a role changes. The payload is already this role's
 * projection, so it renders verbatim.
 *
 * The role is in the query key because it travels in a header, not the URL:
 * a key without it is the same key for every role, and a role switch would
 * serve the previous role's cached projection.
 */
export function usePermissions(enabled: boolean) {
  const role = useSession((state) => state.role);
  return useQuery({
    queryKey: ["me", "permissions", role],
    queryFn: () => get("/api/me/permissions", MePermissionsResponse),
    enabled,
  });
}

/**
 * Does the payload contain a door at this path? A string comparison, not a
 * policy evaluation. The `when` guard is deliberately not consulted — it
 * gates actions against resource state, the server enforces it, and a client
 * that pre-empted it would be re-deriving a state machine.
 */
export function hasDoor(
  rules: readonly GrantedPermissionSchema[] | undefined,
  path: string,
): boolean {
  if (rules === undefined) return false;
  return rules.some((rule) => rule.path === path);
}

/** Does the payload grant this named action? Same lookup, no evaluation. */
export function hasAction(
  rules: readonly GrantedPermissionSchema[] | undefined,
  action: string,
): boolean {
  if (rules === undefined) return false;
  return rules.some((rule) => rule.action === action);
}
