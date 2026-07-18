import { redirect } from "@tanstack/react-router";
import { session, type Role } from "./session";

/**
 * Role-locked entry (§0.7): a role's world is defined ONCE here and consumed
 * by the router (beforeLoad guards), TopBar (link filtering), and GlobalKeys
 * (chord filtering). A reviewer doesn't see a greyed-out Dashboard — the door
 * doesn't exist in their world.
 *
 * Mock-auth phase notes (Clerk replaces this wholesale):
 * - `/account` stays reachable for every role so the mocked role switch can't
 *   lock you out. Under Clerk, typists lose it and seats are server-assigned.
 * - Reviewer/senior/ops keep review access: deep links (escalation clusters,
 *   complaint retros) land on `/orders/$id/review?field=…`.
 * - This is the client-side HALF of role gating. The server re-enforces per
 *   endpoint; nav filtering is UX, the API is the wall.
 */
const WORLDS: Record<Role, readonly string[]> = {
  reviewer: ["/queue", "/orders", "/account"],
  senior: [
    "/escalations",
    "/reconciliation",
    "/seed-correction",
    "/orders",
    "/account",
  ],
  ops: [
    "/dashboard",
    "/ingest",
    "/delivery",
    "/complaints",
    "/blind-status",
    "/orders",
    "/account",
  ],
  engineer: [
    "/bench",
    "/leaderboard",
    "/seed-correction",
    "/golden",
    "/orders",
    "/account",
  ],
  typist: ["/blind", "/account"],
  admin: ["/"],
};

export const ROLE_HOME: Record<Role, string> = {
  reviewer: "/queue",
  senior: "/escalations",
  ops: "/dashboard",
  engineer: "/bench/results",
  typist: "/blind/ord_demo_1", // mock seat assignment; server-assigned under Clerk
  admin: "/queue",
};

export function canAccess(role: Role, path: string): boolean {
  if (role === "admin") return true;
  return WORLDS[role].some(
    (p) => path === p || path.startsWith(`${p}/`) || p === "/",
  );
}

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
