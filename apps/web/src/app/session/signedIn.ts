import { create } from "zustand";
import { DEMO_ACCOUNTS, type DemoAccount } from "./demoAccounts";

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
interface SignedInState {
  account: DemoAccount | null;
  signIn: (account: DemoAccount) => void;
  signOut: () => void;
}

/**
 * The initial value matches `shared/session.ts`'s dev-default role, and the
 * two must not drift: the mock no longer has a default of its own — a request
 * with no `x-mock-role` is refused, not admitted as admin — so what this store
 * and that one agree on is the only session the app boots with. It also keeps
 * deep links working across reloads: nothing persists, so a client-only
 * session would evaporate and `?field=` would land on the sign-in screen. The
 * sign-in screen is reached by signing out. With real auth the default becomes
 * "no session" and this value goes with the rest of the file.
 *
 * Found by ROLE, not by name — the name is `SEAT_IDENTITIES`' to decide, and
 * a literal here would be a second place to change it.
 */
const DEV_DEFAULT: DemoAccount | undefined = DEMO_ACCOUNTS.find(
  (a) => a.role === "admin",
);

export const useSignedIn = create<SignedInState>((set) => ({
  account: DEV_DEFAULT ?? null,
  signIn: (account) => set({ account }),
  signOut: () => set({ account: null }),
}));
