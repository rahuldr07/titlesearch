import { queryOptions } from "@tanstack/react-query";
import { MePermissionsResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

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
