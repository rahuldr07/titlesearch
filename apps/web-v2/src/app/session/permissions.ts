import { useQuery } from "@tanstack/react-query";
import { MePermissionsResponse, type GrantedPermissionSchema } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { useSession } from "../../shared/session";

/**
 * RULES AS DATA. The client renders the permissions it RECEIVES and never
 * re-derives one (INVARIANTS 41: there is exactly one permission table, and it
 * is the server's).
 *
 * `packages/contract` exports `canAccess`/`rulesFor` and it would be one import
 * to call them here. That is precisely what is refused: a second evaluation of
 * the table in the browser is a second table, and it drifts from the first at
 * exactly the moment a role changes. The payload from
 * `GET /api/me/permissions` is already this role's projection with holder lists
 * redacted — other worlds are unrepresented in it, not hidden — so rendering it
 * verbatim is both simpler and the only thing that satisfies INVARIANTS 42/43.
 */
/**
 * THE ROLE IS IN THE QUERY KEY, and leaving it out was a real defect caught by
 * driving the built app rather than by reading it.
 *
 * The role does not travel in the URL — `shared/api.ts` puts it in the
 * `x-mock-role` HEADER — so a key of `["me","permissions"]` alone is the same
 * key for every role. Signing out of admin and back in as a reviewer served the
 * CACHED ADMIN PROJECTION, and the rail drew Intake, Escalations, Golden set
 * and Bench to a reviewer who holds none of them. That is INVARIANTS 42/43
 * failing silently: the doors were not dimmed, they were WRONG.
 *
 * A cache key must name every input the response varies with. The header is an
 * input; it is now in the key.
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
 * Does the payload contain a door at this path?
 *
 * A STRING COMPARISON, not a policy evaluation. `path` on a granted permission
 * is the route prefix the server already decided this role may enter; asking
 * whether it is in the list is a lookup. The `when` guard is deliberately NOT
 * consulted — it gates ACTIONS against resource state, the server enforces it,
 * and a client that pre-empted it would be re-deriving a state machine.
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
