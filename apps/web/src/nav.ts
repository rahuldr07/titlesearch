import { redirect } from "@tanstack/react-router";
import { canAccess } from "@titlepipe/contract";
import { session, type Role } from "./session";

/**
 * Role-locked entry (§0.7), derived — not defined — here. The permission
 * table in @titlepipe/contract (authz.ts) is the single source of truth;
 * this module re-exports its `canAccess` for the router (beforeLoad guards),
 * TopBar (link filtering), GlobalKeys (chord filtering), and the home hub,
 * and adds the routing-only pieces (ROLE_HOME, requireAccess).
 *
 * A reviewer doesn't see a greyed-out Dashboard — the door doesn't exist in
 * their world, because their rule projection never mentions it.
 *
 * Mock-auth phase notes (Clerk replaces the session wholesale):
 * - This is the client-side HALF of gating. The MSW handlers enforce the
 *   same table on every mutation; core-api re-enforces per endpoint at P1.
 */
export { canAccess };

export const ROLE_HOME: Record<Role, string> = {
  reviewer: "/queue",
  senior: "/escalations",
  ops: "/dashboard",
  engineer: "/bench/results",
  typist: "/blind/ord_demo_1", // mock seat assignment; server-assigned under Clerk
  admin: "/queue",
};

/**
 * Router guard: call from a route's `beforeLoad` with the route's own path.
 * Denied → redirect to the role's home, never an error page — a door that
 * doesn't exist shouldn't 403, it should never have been a destination.
 */
export function requireAccess(path: string): void {
  if (!canAccess(session.role, path)) {
    throw redirect({ to: ROLE_HOME[session.role] });
  }
}
