import { createContext, useContext } from "react";

/**
 * The sidebar's shared state, in its own module so sidebar.tsx exports only
 * components (fast refresh). The shell and provider are sidebar.tsx.
 */

/** The chord the rail folds on, exported so `app/keyboard/` binds one name. */
export const SIDEBAR_KEY = "b";

export interface SidebarContextValue {
  readonly collapsed: boolean;
  readonly toggle: () => void;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);

/** Throws rather than defaulting: a menu outside its rail is a wiring bug. */
export function useSidebar(): SidebarContextValue {
  const value = useContext(SidebarContext);
  if (value === null) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return value;
}
