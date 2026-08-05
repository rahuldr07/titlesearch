import { queryOptions } from "@tanstack/react-query";
import { MePermissionsResponse, MeProfileResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * WHO you are — the question `/api/me/permissions` deliberately does not answer.
 *
 * Identity and authorisation are different questions, and both are needed here:
 * one card says what you may do, another says whose account this is. Conflating
 * them is how a screen ends up trusting a name it got from a permissions
 * payload — and the name on this screen is load-bearing beyond decoration,
 * because it is the signature on a golden correction.
 *
 * Not keyed on the acting role: the mock role switch changes what you may do,
 * never who you are.
 */
export const myProfileQuery = queryOptions({
  queryKey: ["me", "profile"],
  queryFn: () => get("/api/me/profile", MeProfileResponse),
});

/**
 * The one real thing on this screen.
 *
 * "What I can do" is rendered from the SERVER'S projection and never from a
 * local table — the client asks who it is and prints the answer. A second copy
 * of the authorization table in the browser is a copy free to drift, and the
 * one that drifts is always the one that shows someone a door they no longer
 * hold.
 *
 * Keyed on the acting role so a role switch REFETCHES rather than serving a
 * cached world. A stale world is worse than no world.
 */
export function myPermissionsQuery(role: string) {
  return queryOptions({
    queryKey: ["me", "permissions", role],
    queryFn: () => get("/api/me/permissions", MePermissionsResponse),
  });
}
