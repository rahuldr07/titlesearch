import { create } from "zustand";
import { isRole, type Role } from "@titlepipe/contract";

/**
 * The acting role, for the mock backend only. Dev-only: in production,
 * identity comes from the session cookie and the server enforces
 * authorization independently — the client never asserts who it is.
 * `packages/mocks` reads `x-mock-role` so the authz specs can prove the
 * server refuses; this must not survive cutover to the real API.
 * Zustand, not a Query cache: ephemeral UI state, never persisted.
 */
interface SessionState {
  role: Role;
  /**
   * The signer's display name, read-only from the session — never a client
   * field, so who signed a golden correction is not typeable. It has no
   * setter of its own and travels with the role: `actAs` takes both, so
   * switching seats cannot leave the previous examiner's name on the next
   * signature.
   */
  actor: string;
  actAs: (seat: { role: Role; actor: string }) => void;
}

export const useSession = create<SessionState>((set) => ({
  // The mock server treats a missing header as the dev-default admin session.
  role: "admin",
  actor: "L. Vance",
  actAs: ({ role, actor }) => set({ role, actor }),
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
 * The signer, for the fetch layer — same dev-only caveat as the role above.
 * The mock reads `x-mock-actor` so the append-only golden log is signed with
 * the same name the correction screen showed.
 */
export function currentActor(): string {
  return useSession.getState().actor;
}
