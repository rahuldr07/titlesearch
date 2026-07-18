import { create } from "zustand";

/**
 * Mocked local session (auth is mocked until Clerk lands). The demo identity
 * matches the .dc.html spec copy ("L. Vance", a synthetic persona); the dev
 * default is admin so every screen stays reachable while building.
 *
 * Backed by a zustand store so role switches re-render everything role-locked
 * (TopBar link filtering, GlobalKeys chord map, dashboard gate). Render-time
 * readers use the `useSession` hook; event-time readers (router beforeLoad
 * guards, keydown handlers) use the `session` proxy, which reads the store at
 * call time — both always agree.
 */
export type Role =
  | "reviewer"
  | "senior"
  | "ops"
  | "engineer"
  | "typist"
  | "admin";

export interface Session {
  name: string;
  role: Role;
}

interface SessionStore extends Session {
  setRole: (role: Role) => void;
}

export const useSession = create<SessionStore>((set) => ({
  name: "L. Vance",
  role: "admin",
  setRole: (role) => set({ role }),
}));

/** Non-React access. `session.role = "reviewer"` writes through to the store. */
export const session = {
  get name(): string {
    return useSession.getState().name;
  },
  get role(): Role {
    return useSession.getState().role;
  },
  set role(role: Role) {
    useSession.getState().setRole(role);
  },
};
