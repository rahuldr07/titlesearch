import { create } from "zustand";

/**
 * Rail collapse — a pure UI preference, persisted to localStorage. NEVER
 * session or permission state (those live in session.ts / authz.ts). Kept in
 * its own module so both the rail (components/SideRail.tsx) and the keyboard
 * layer (components/GlobalKeys.tsx, the `[` toggle) read one store.
 */
const STORAGE_KEY = "titlepipe.rail.collapsed";

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

interface RailStore {
  collapsed: boolean;
  toggle: () => void;
}

export const useRail = create<RailStore>((set) => ({
  collapsed: readCollapsed(),
  toggle: () =>
    set((s) => {
      const collapsed = !s.collapsed;
      try {
        localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
      } catch {
        /* private mode — the preference just won't persist */
      }
      return { collapsed };
    }),
}));
