import { create } from "zustand";
import { isRole, type Role } from "@titlepipe/contract";

/**
 * The acting role, for the MOCK BACKEND ONLY.
 * ⚠ DEV-ONLY, and this is conflict C12. In production, identity comes from the
 * session cookie and the server enforces authorization independently — the
 * client never asserts who it is. The design's own "Acting as" control says as
 * much: *"Preview control — not in production. The server enforces
 * authorization independently."*
 * It exists here because `packages/mocks` reads `x-mock-role` to stand in for
 * the Clerk JWT claim, and the harvested authz specs switch roles to prove the
 * SERVER refuses — `authz.spec` #1 asserts a 403 arrives before validation
 * does. Removing this would remove the ability to test that at all.
 * It must not survive cutover to the real API. `hard.spec` #2 already pins the
 * shape of the risk: a forged role must be refused, never honoured.
 * Zustand, not a Query cache: this is ephemeral UI state (§7), and it never
 * persists — no `persist` middleware, nothing in browser storage (§9.11).
 */
interface SessionState {
  role: Role;
  /**
   * The signer's display name, READ-ONLY. `golden.spec` #3 pins the rule it
   * exists for: *"the signer is not a client field — it's shown read-only from
   * the session"*. A correction to the golden set is the most consequential
   * write in the product — it changes what every future measurement is graded
   * against — so the one thing that must not be typeable is who did it.
   * There is no setter. In production this arrives with the session; here it
   * is fixed, and `x-mock-actor` carries it so the mock records the same name
   * the screen displays rather than the screen inventing one after the fact.
   */
  actor: string;
  actAs: (role: Role) => void;
}

export const useSession = create<SessionState>((set) => ({
  // The mock server treats a missing header as the dev-default admin session.
  role: "admin",
  actor: "L. Vance",
  actAs: (role) => set({ role }),
}));

/**
 * Read the role outside React, for the fetch layer. A hook cannot be called
 * from `api.ts`, and threading the role through every call site would put an
 * auth concern into every query.
 */
export function currentRole(): Role {
  const { role } = useSession.getState();
  return isRole(role) ? role : "admin";
}

/**
 * The signer, for the fetch layer — same DEV-ONLY caveat as the role above.
 * The server will derive this from the session; until then the mock reads
 * `x-mock-actor`, so the append-only golden log is signed with the same name
 * the correction screen showed the person who signed it.
 */
export function currentActor(): string {
  return useSession.getState().actor;
}
