import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { doorsFor, type Door } from "../entities/nav/doors";
import { Sidebar, type SidebarDoorItem, type SidebarSection } from "../entities/nav/Sidebar";
import type { LifecycleStage } from "../entities/nav/LifecycleRail";
import { useSession } from "../shared/session";
import { useAttention, type Attention } from "./attention";
import { useNavCollapsed, useTheme } from "./preferences";
import { orderFromPath } from "./orderFromPath";
import { SidebarBrand } from "./SidebarBrand";
import {
  orderPipelineQuery,
  orderSignoffQuery,
  orderCompletenessQuery,
  orderFieldsQuery,
  stageAugmentFor,
  reviewAugment,
} from "./orderLifecycle";

/**
 * The "THIS ORDER" numbered pipeline — Queue/Overview live in WORK now (Task
 * 12). Review sits BETWEEN Completeness and Delivered (the design's own
 * order: Upload, Questions, Processing, Completeness, Review, Delivered — a
 * report is reviewed before it is delivered), so it is spliced in below
 * rather than appended after `DELIVERED`.
 */
const FLOW: readonly { path: string; label: string }[] = [
  { path: "/ingest", label: "Upload" },
  { path: "/questions", label: "Questions" },
  { path: "/processing", label: "Processing" },
  { path: "/completeness", label: "Completeness" },
];
const DELIVERED = { path: "/delivered", label: "Delivered" };

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

  // THIS ORDER's live state — the URL order, same as `OrderStrip` (Task 11's
  // principle). All four disabled together off an order screen and on the
  // capture seat, so neither adds a GET the zero-GET rule forbids.
  const orderId = onCaptureSeat ? null : orderFromPath(pathname);
  const enabled = orderId !== null;
  const { data: pipeline } = useQuery({ ...orderPipelineQuery(orderId ?? ""), enabled });
  const { data: signoff } = useQuery({ ...orderSignoffQuery(orderId ?? ""), enabled });
  const { data: completeness } = useQuery({ ...orderCompletenessQuery(orderId ?? ""), enabled });
  const { data: fields } = useQuery({ ...orderFieldsQuery(orderId ?? ""), enabled });

  if (onCaptureSeat) return null;

  const heldDoors = doorsFor(role);
  const held = new Set(heldDoors.map((door) => door.path));
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const attentionFor = (path: string): Attention =>
    path === "/escalations" ? escalationAttention : null;

  const flowItems: { to: string; label: string }[] = FLOW.filter((item) => held.has(item.path)).map((item) => ({
    to: item.path,
    label: item.label,
  }));
  if (orderId !== null) flowItems.push({ to: `/orders/${orderId}/review`, label: "Review" });
  if (held.has(DELIVERED.path)) flowItems.push({ to: DELIVERED.path, label: DELIVERED.label });

  const lifecycle: LifecycleStage[] = flowItems.map((item, i) => {
    const augment =
      orderId === null
        ? { done: false, badge: null }
        : item.to === `/orders/${orderId}/review`
          ? reviewAugment({ pipeline, fields })
          : stageAugmentFor(item.to, { pipeline, signoff, completeness });
    return { to: item.to, label: item.label, active: isActive(item.to), attention: attentionFor(item.to), n: i + 1, ...augment };
  });

  const toItem = (door: Door): SidebarDoorItem => ({
    to: door.path,
    label: door.label,
    icon: door.icon,
    active: isActive(door.path),
    attention: attentionFor(door.path),
  });
  const sections: SidebarSection[] = [];
  const work = heldDoors.filter((d) => d.group === "work").map(toItem);
  if (work.length > 0) sections.push({ kind: "doors", label: "WORK", doors: work });
  if (lifecycle.length > 0) sections.push({ kind: "lifecycle", label: "THIS ORDER", stages: lifecycle });
  const admin = heldDoors.filter((d) => d.group === "admin").map(toItem);
  if (admin.length > 0) sections.push({ kind: "doors", label: "ADMIN", doors: admin });
  const reference = heldDoors.filter((d) => d.group === "reference").map(toItem);
  if (reference.length > 0) sections.push({ kind: "doors", label: "REFERENCE", doors: reference });

  return (
    <Sidebar
      collapsed={collapsed}
      onToggle={toggleCollapsed}
      onNavigate={(to) => void navigate({ to })}
      brand={<SidebarBrand />}
      sections={sections}
    />
  );
}
