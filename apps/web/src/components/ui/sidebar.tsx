import { createContext, useContext, useMemo, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/* The other two thirds, re-exported so the barrel names `./sidebar` once rather
   than three siblings. The split is the 150-line gate; the component is one. */
export { SidebarHeader, SidebarContent, SidebarFooter } from "./sidebar-regions";
export {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuLink,
  SidebarMenuLabel,
} from "./sidebar-menu";

/**
 * THE SIDEBAR SHELL — shadcn's `sidebar` registry component, adapted.
 *
 * The registry ships 714 lines and 23 exports. This is the shell half; the
 * menu half is `sidebar-menu.tsx`. Roughly two thirds of the registry file is
 * deleted, and every deletion has a reason recorded here rather than in a
 * commit message that nobody reads beside the code.
 *
 * ══ 1. THE MOBILE HALF IS GONE ══════════════════════════════════════════════
 *
 * `useIsMobile`, the `Sheet` branch, `SIDEBAR_WIDTH_MOBILE`, `openMobile` and
 * `setOpenMobile` are DELETED. `src/styles.css:59` sets `min-width: 1360px` on
 * the app, and the registry's breakpoint is 768px — that viewport cannot occur,
 * so the branch is not merely unused, it is UNREACHABLE. Keeping it would mean
 * carrying a `Sheet` import, a media-query hook and a second render path that
 * no test can ever enter, which is how dead code gets "fixed" later by somebody
 * who assumes it runs.
 *
 * ══ 2. THE COOKIE IS GONE, AND THE STATE IS A PROP ══════════════════════════
 *
 * The registry writes `document.cookie` on every toggle. INVARIANTS 67-68 put
 * this on the SERVER (`GET/PATCH /api/me/preferences`, decision C16,
 * `Preferences.nav_collapsed` at `packages/contract/src/intake.ts:375`) and ban
 * browser storage outright. A cookie is browser storage with a network
 * side-effect, which is worse than `localStorage`, not better.
 *
 * ⚠ TODO(nav-collapsed): wire `collapsed`/`onCollapsedChange` to
 * `GET/PATCH /api/me/preferences`. This component takes the state as a PROP and
 * owns none of it — there is no internal `useState` fallback ON PURPOSE, because
 * an uncontrolled default is exactly how a component starts persisting things
 * again. `nav_collapsed` is `boolean | null` and null means "never chosen", so
 * the route default governs; that three-state resolution belongs to the caller
 * that can see the route, not to the shell.
 *
 * ══ 3. NO `dark:` VARIANTS ══════════════════════════════════════════════════
 *
 * All 71 registry `dark:` variants are deleted. `tokens.css` has no dark
 * register: dark is CHROME, not a theme, and the rail's own ink family
 * (`--color-rail-*`) is unconditional here. `--color-ink-primary` measures
 * 1.03:1 on this surface, so a component that reached into the app palette
 * while standing on the column would render blank, not merely wrong.
 *
 * Registry token → ours: `bg-sidebar` → `bg-rail-surface`,
 * `text-sidebar-foreground` → `text-rail-ink`, `sidebar-border` →
 * `rail-line`, `sidebar-accent` → `rail-line` (the hover wash),
 * `sidebar-primary` → `rail-accent`.
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
 * The registry's `SidebarProvider` also rendered a wrapper `div` with
 * `min-h-svh` and CSS custom properties for the widths. Both are deleted:
 * `rootRoute.tsx` owns the frame and INVARIANT 60 says it is one viewport tall
 * and never scrolls, so `min-h-svh` here would fight it. This is context only.
 *
 * The registry's `⌘B` keyboard shortcut is also deleted. `app/keyboard/` owns
 * every chord in this app through `useChords`, which knows about text-field
 * scoping and overlay suppression; a bare `window.addEventListener` inside a
 * kit component types a `b` into an input as a fold.
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
 * THE COLUMN. 240px, full height, on the rail surface.
 *
 * The registry's three `variant`s (sidebar / floating / inset) and three
 * `collapsible` modes (offcanvas / icon / none) are DELETED — nine
 * combinations, of which the design draws one. `floating` and `inset` round the
 * column and add a shadow, which makes the rail a CARD sitting on the canvas;
 * the design has it flush to the viewport edge with a hairline. `offcanvas`
 * slides it out entirely, which at 1360px minimum leaves a permanent gap.
 *
 * Also deleted: the `sidebar-gap` and `sidebar-container` divs, which fake a
 * document flow around a `fixed` element. This is a flex child of the frame at
 * `h-full` — INVARIANT 63, a COLUMN, not page-sticky — nothing to fake. THE
 * RIGHT-EDGE HAIRLINE (`border-right:1px solid #2C2742`, the 7% white the
 * header and footer draw) was MISSING: the column butted the paper with no seam.
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
