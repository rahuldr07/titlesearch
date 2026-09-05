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
  actAs: (role: Role) => void;
}

/*
 * The store holds the ROLE and nothing else. It used to carry the signer's
 * display name too, which the fetch layer sent as `x-mock-actor` and the mock
 * stamped onto the golden ledger — so the name on a permanent correction was
 * a string the browser handed over. The name now lives in the contract's
 * `SEAT_IDENTITIES` and is resolved server-side from the role; there is no
 * wire field naming a person, which is what makes the signature one.
 */
export const useSession = create<SessionState>((set) => ({
  // Matches `signedIn.ts`'s dev-default seat. The mock no longer has a default
  // of its own — a request with no role header is refused, not admitted as
  // admin — so this value is the only thing standing between boot and a 401.
  role: "admin",
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
