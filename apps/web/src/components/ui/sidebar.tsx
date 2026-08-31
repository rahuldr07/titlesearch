import { createContext, useContext, useMemo, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/* Re-exported so the barrel names `./sidebar` once rather than three
   siblings. */
export { SidebarHeader, SidebarContent, SidebarFooter } from "./sidebar-regions";
export {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuLink,
  SidebarMenuLabel,
} from "./sidebar-menu";

/**
 * The sidebar shell; the menu half is sidebar-menu.tsx.
 *
 * Collapsed state is a prop and the component owns none of it — preferences
 * live on the server, browser storage is banned, and there is no internal
 * useState fallback on purpose: an uncontrolled default is exactly how a
 * component starts persisting things again. `nav_collapsed` is
 * `boolean | null` and null means "never chosen", so the route default
 * governs; that resolution belongs to the caller that can see the route.
 * TODO(nav-collapsed): wire `collapsed`/`onCollapsedChange` to
 * `GET/PATCH /api/me/preferences`.
 *
 * The rail's ink family (`--color-rail-*`) is unconditional: the app
 * palette's ink-primary measures 1.03:1 on this surface and would render
 * blank, not merely wrong.
 */

const SIDEBAR_KEY = "b";

interface SidebarContextValue {
  readonly collapsed: boolean;
  readonly toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/** Throws rather than defaulting: a menu outside its rail is a wiring bug. */
export function useSidebar(): SidebarContextValue {
  const value = useContext(SidebarContext);
  if (value === null) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return value;
}

/**
 * Context only — no wrapper div: rootRoute.tsx owns the frame. No keyboard
 * shortcut here either: app/keyboard/ owns every chord through `useChords`,
 * which knows about text-field scoping and overlay suppression; a bare
 * `window.addEventListener` in a kit component types a `b` into an input as
 * a fold.
 */
export function SidebarProvider(props: {
  readonly collapsed: boolean;
  readonly onCollapsedChange: (collapsed: boolean) => void;
  readonly children: ReactNode;
}) {
  const { collapsed, onCollapsedChange } = props;
  const value = useMemo<SidebarContextValue>(
    () => ({ collapsed, toggle: () => onCollapsedChange(!collapsed) }),
    [collapsed, onCollapsedChange],
  );
  return (
    <SidebarContext.Provider value={value}>{props.children}</SidebarContext.Provider>
  );
}

/** The chord the rail folds on, exported so `app/keyboard/` binds one name. */
export { SIDEBAR_KEY };

/**
 * The column: 240px, full height, on the rail surface — a flex child of the
 * frame, not a fixed element. The right-edge hairline is the seam against
 * the paper; do not lose it.
 */
export function Sidebar(props: {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly label: string;
  readonly testId?: string | undefined;
}) {
  const { collapsed } = useSidebar();
  return (
    <nav
      data-slot="sidebar"
      data-testid={props.testId}
      data-collapsed={collapsed ? "1" : "0"}
      aria-label={props.label}
      className={cx(
        "tp-state flex h-full shrink-0 flex-col justify-between overflow-hidden",
        "border-r border-rail-line bg-rail-surface text-rail-ink",
        collapsed ? "w-39" : "w-120",
        props.className,
      )}
    >
      {props.children}
    </nav>
  );
}
