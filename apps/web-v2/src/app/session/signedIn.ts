import { create } from "zustand";
import type { Role } from "@titlepipe/contract";
import { DEMO_ACCOUNTS } from "./demoAccounts";

/**
 * WHETHER ANYBODY IS SIGNED IN — and this store is a CONTRACT GAP made visible,
 * not a design choice.
 *
 * The design's screen 1 is a sign-in form plus four demo accounts. There is no
 * authentication surface in `@titlepipe/contract` at all: no login endpoint, no
 * session endpoint, no logout. `MeProfileResponse` (intake.ts:359) answers WHO
 * you are for an EXISTING session and `packages/mocks` ships no handler for it;
 * `GET /api/me/permissions` answers what you may do and reads `x-mock-role`.
 * So "is there a session" has no server to ask, and Clerk lands at P1.
 *
 * Consequences, stated rather than hidden:
 *   - This is CLIENT-HELD and therefore forgeable. It gates rendering only. It
 *     is NOT a permission check: every door and every action is drawn from
 *     `GET /api/me/permissions`, and the server refuses regardless.
 *   - It is deliberately NOT persisted. §9.11 forbids browser storage, and a
 *     forgeable session that survived a reload would be worse than one that
 *     does not.
 *   - It goes at cutover, whole. Nothing else imports it except the route
 *     guard, the sign-in screen and the profile block.
 *
 * The one thing it genuinely owns is the design's own rule: "Keyboard/global
 * shortcuts disabled until signed in." Chords are not installed while this is
 * null (`shared/chords.ts` — dead, not merely inert).
 */
export interface DemoAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** The CONTRACT role (authz.ts:31-38), never the design's job title. */
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
 * THE INITIAL VALUE IS THE MOCK SERVER'S OWN DEFAULT, and that is the whole
 * argument for it.
 *
 * `packages/mocks/src/handlers.ts:1398` treats a MISSING `x-mock-role` as "the
 * dev-default admin session", and `shared/session.ts` already mirrors that with
 * `role: "admin", actor: "L. Vance"`. The server's position is therefore that
 * there IS a session in mock mode. Booting signed-out would make the client
 * disagree with the server about whether the reader exists, and the client does
 * not get to hold that opinion.
 *
 * IT ALSO KEEPS DEEP LINKS FIRST-CLASS (INVARIANT 55). Nothing persists —
 * §9.11 forbids browser storage — so a session that started as client-only
 * would evaporate on every reload, and `?field=` pasted into an address bar
 * would land on the sign-in screen instead of the field. A deep link that only
 * works if you never reload is not a deep link.
 *
 * SO HOW IS SCREEN 1 EVER SEEN? Sign out. The design's own control is "Switch
 * user / Sign out" and both lead here, which is exactly the route the design
 * gives the sign-in screen. It is reachable, it is real, and it does not
 * require the app to pretend nobody is there when the server says somebody is.
 *
 * AT P1 THIS INVERTS AND SHOULD. Clerk answers "is there a session" from a
 * cookie, the default becomes "no", and this initial value is deleted with the
 * rest of the file.
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
