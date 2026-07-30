import { useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { doorsFor } from "../entities/nav/doors";
import { Sidebar, type SidebarDoorItem } from "../entities/nav/Sidebar";
import type { LifecycleStage } from "../entities/nav/LifecycleRail";
import { useSession } from "../shared/session";
import { useAttention, type Attention } from "./attention";
import { useNavCollapsed, useTheme } from "./preferences";
import { orderFromPath } from "./orderFromPath";
import { Eyebrow } from "../shared/ui/Eyebrow";

/** The order lifecycle, in the sequence an order moves through. */
const FLOW: readonly { path: string; label: string }[] = [
  { path: "/queue", label: "Queue" },
  { path: "/overview", label: "Overview" },
  { path: "/ingest", label: "Upload" },
  { path: "/questions", label: "Questions" },
  { path: "/processing", label: "Processing" },
  { path: "/completeness", label: "Completeness" },
  { path: "/delivered", label: "Delivered" },
];

/**
 * The chrome — the SMART wrapper around the presentational left rail. It owns
 * the concerns entities may not touch (§6): the router, the preference fetch,
 * the acting role and the attention query. It hands the rail a plain door set
 * and the persisted collapse.
 *
 * THE ACCOUNT MENU AND THE ORDER COUNTS LIVE IN `OrderStrip` NOW, not here —
 * the full-width top bar the design draws on every screen (§11 2026-07-30
 * revision). `AppChrome` keeps the theme fetch and the `data-theme` effect
 * (still needed for the whole document, capture seat aside) but no longer
 * renders `AccountMenu`; `OrderStrip` is `AppChrome`'s sibling in `rootRoute`,
 * not its child, and reads the same URL and the same preference independently.
 *
 * IT IS ABSENT ON THE CAPTURE SEAT, structurally, not cosmetically. A typist on
 * a blind pass must not see the pipeline's world — the doors name screens that
 * tell them what the machine already thinks. The preference fetch and the
 * attention query are BOTH disabled there, so the seat issues zero /api GETs
 * (`blind-blindness.spec`); removing the rail is the same rule that kills the
 * keyboard layer on `/blind/*`.
 *
 * THE ORDER COMES FROM THE URL, never a remembered "current order" — two tabs
 * on two orders is a normal way to work.
 */
export function AppChrome() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const role = useSession((s) => s.role);
  const onCaptureSeat = pathname.startsWith("/blind");
  const onReview = /^\/orders\/[^/]+\/review/.test(pathname);
  // Review starts collapsed on first mount; the preference wins once loaded.
  const [collapsed, toggleCollapsed] = useNavCollapsed(!onCaptureSeat, onReview);
  // Same zero-GET rule as the collapse: no theme fetch on the capture seat.
  // Only the VALUE is needed here now (the toggle moved to `OrderStrip` with
  // `AccountMenu`) — this call still owns the `data-theme` effect below.
  const [theme] = useTheme(!onCaptureSeat);
  // `:root` IS TitlePipe; `[data-theme="mocha"]` is the only value that means
  // anything else, so the attribute is set only for the non-default theme
  // rather than toggled between two literal values (`tokens.css` §8).
  useEffect(() => {
    if (theme === "mocha") {
      document.documentElement.dataset.theme = "mocha";
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [theme]);
  // One escalations query, disabled on the capture seat (the zero-GET rule).
  const escalationAttention = useAttention(onCaptureSeat ? "" : "/escalations");

  if (onCaptureSeat) return null;

  const orderId = orderFromPath(pathname);
  const held = new Set(doorsFor(role).map((door) => door.path));
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const attentionFor = (path: string): Attention =>
    path === "/escalations" ? escalationAttention : null;

  const lifecycle: LifecycleStage[] = FLOW.filter((item) => held.has(item.path)).map((item) => ({
    to: item.path,
    label: item.label,
    active: isActive(item.path),
    attention: attentionFor(item.path),
  }));
  if (orderId !== null) {
    const to = `/orders/${orderId}/review`;
    lifecycle.push({ to, label: "Review", active: isActive(to), attention: null });
  }

  const flowPaths = new Set(FLOW.map((item) => item.path));
  const worlds: SidebarDoorItem[] = doorsFor(role)
    .filter((door) => !flowPaths.has(door.path))
    .map((door) => ({
      to: door.path,
      label: door.label,
      active: isActive(door.path),
      attention: attentionFor(door.path),
    }));

  const brand = (
    <Link to="/" className="flex min-w-0 items-center gap-3 no-underline">
      <span aria-hidden className="flex size-8 shrink-0 flex-col justify-center gap-1 rounded-2 border-2 border-action px-1">
        <span className="h-0.5 rounded-pill bg-action" />
        <span className="h-0.5 w-3/4 rounded-pill bg-action" />
        <span className="h-0.5 rounded-pill bg-action" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold tracking-stamp text-ink-primary">TITLEPIPE</span>
        <Eyebrow variant="caption">Abstractor Review</Eyebrow>
      </span>
    </Link>
  );

  return (
    <Sidebar
      collapsed={collapsed}
      onToggle={toggleCollapsed}
      onNavigate={(to) => void navigate({ to })}
      brand={brand}
      lifecycle={lifecycle}
      worlds={worlds}
    />
  );
}
