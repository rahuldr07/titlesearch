import { create } from "zustand";
import type { Role } from "@titlepipe/contract";
import { DEMO_ACCOUNTS } from "./demoAccounts";

/**
 * Whether anybody is signed in. There is no authentication surface in the
 * contract — no login, session, or logout endpoint — so "is there a session"
 * has no server to ask until real auth lands. This store is client-held and
 * forgeable: it gates rendering only, never permissions — every door and
 * action is drawn from `GET /api/me/permissions` and the server refuses
 * regardless. Deliberately not persisted, and it goes whole at cutover.
 * The one thing it genuinely owns: chords are not installed while this is
 * null (`shared/chords.ts`).
 */
export interface DemoAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** The contract role, never the design's job title. */
  readonly role: Role;
  /** The design's own words for the seat, shown beside the name. */
  readonly seat: string;
  readonly initials: string;
}

interface SignedInState {
  account: DemoAccount | null;
  signIn: (account: DemoAccount) => void;
  signOut: () => void;
}

/**
 * The initial value is the mock server's own default: the mock treats a
 * missing `x-mock-role` as the dev-default admin session, so booting
 * signed-out would make the client disagree with the server about whether
 * the reader exists. It also keeps deep links working across reloads —
 * nothing persists, so a client-only session would evaporate and `?field=`
 * would land on the sign-in screen. The sign-in screen is reached by
 * signing out. With real auth the default becomes "no session" and this
 * value goes with the rest of the file.
 */
const DEV_DEFAULT: DemoAccount | undefined = DEMO_ACCOUNTS.find(
  (a) => a.name === "L. Vance",
);

export const useSignedIn = create<SignedInState>((set) => ({
  account: DEV_DEFAULT ?? null,
  signIn: (account) => set({ account }),
  signOut: () => set({ account: null }),
}));

/** Read outside React — the route guard runs before any component mounts. */
export function isSignedIn(): boolean {
  return useSignedIn.getState().account !== null;
}
