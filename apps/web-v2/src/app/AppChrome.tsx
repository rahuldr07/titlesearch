import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { doorsFor } from "../entities/nav/doors";
import { Sidebar, type SidebarDoorItem } from "../entities/nav/Sidebar";
import type { LifecycleStage } from "../entities/nav/LifecycleRail";
import { useSession } from "../shared/session";
import { useAttention, type Attention } from "./attention";
import { useNavCollapsed } from "./preferences";
import { AccountMenu } from "./AccountMenu";
import { OrderCounts } from "./OrderCounts";
import { Eyebrow } from "../shared/ui/Eyebrow";

/** The order in view, taken from the URL. Null on screens that have no order. */
function orderFromPath(pathname: string): string | null {
  return /^\/orders\/([^/]+)\//.exec(pathname)?.[1] ?? null;
}

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
 * the acting role and the attention query. It hands the rail a plain door set,
 * the persisted collapse, and the account menu as its foot.
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
      foot={
        <div className="flex flex-col gap-3">
          {orderId === null ? null : <OrderCounts orderId={orderId} />}
          <AccountMenu />
        </div>
      }
    />
  );
}
