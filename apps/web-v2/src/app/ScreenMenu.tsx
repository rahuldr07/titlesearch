import { Link, useRouterState } from "@tanstack/react-router";
import { canAccess } from "@titlepipe/contract";
import { doorsFor } from "../entities/nav/doors";
import { useSession } from "../shared/session";
import { useAttention } from "./attention";
import { cn } from "../shared/ui/classNames";

/**
 * The navigator — the design's replacement for the deleted side rail.
 *
 * It runs along the top and does not take width from the document. On the
 * review workstation the document IS the work, and a 240px rail was taking it
 * from the one pane that cannot spare it.
 *
 * A ROLE'S WORLD IS ABSENT, NOT DIMMED. The same `canAccess` table the server
 * gates with decides what appears, so no greyed door invites somebody to ask
 * for a screen that would refuse them anyway. It re-renders on a role switch
 * without a reload, because a navigator that lied until you refreshed would be
 * worse than one that showed everything.
 */
const FLOW: readonly { path: string; label: string }[] = [
  { path: "/queue", label: "Queue" },
  { path: "/overview", label: "Overview" },
  { path: "/ingest", label: "Upload" },
  { path: "/questions", label: "Questions" },
  { path: "/processing", label: "Processing" },
  { path: "/completeness", label: "Completeness" },
  { path: "/review", label: "Review" },
  { path: "/delivered", label: "Delivered" },
];

/** Flow screens with an authorisation row; the rest are unrestricted. */
const GATED = new Set(["/queue", "/review"]);

function Door({ path, label, collapsed, active, to }: {
  path: string;
  label: string;
  collapsed: boolean;
  active: boolean;
  to: string;
}) {
  const attention = useAttention(path);
  return (
    <Link
      to={to}
      data-testid={`rail-door-${path}`}
      title={collapsed ? label : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-3 px-4 py-2 text-xs font-medium",
        active ? "bg-surface-panel text-ink-primary" : "text-ink-secondary",
      )}
    >
      <span className={collapsed ? "sr-only" : undefined}>{label}</span>
      {collapsed ? <span aria-hidden className="font-mono text-micro">{label.slice(0, 2)}</span> : null}
      {attention === null ? null : (
        <span
          data-testid={`rail-dot-${path}`}
          aria-label={attention === "halt" ? `${label}: unresolved` : `${label}: open`}
          className={cn(
            "size-2 shrink-0 rounded-pill",
            attention === "halt" ? "bg-state-halt" : "bg-state-attend",
          )}
        />
      )}
    </Link>
  );
}

export function ScreenMenu({ orderId, collapsed }: { orderId: string | null; collapsed: boolean }) {
  const role = useSession((s) => s.role);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const flow = FLOW.filter((item) => !GATED.has(item.path) || canAccess(role, item.path));
  /*
   * The measurement screens the export does not draw still need a door, but
   * they do NOT belong in the order flow. Merging both into one strip made it
   * overflow its own width and clip the last item — a navigator you cannot read
   * to the end is worse than one that admits it has two halves.
   *
   * So they sit after a divider and the strip WRAPS rather than scrolling: the
   * flow is the sequence an order moves through and reads left to right, while
   * the worlds are places you go. A door hidden behind a horizontal scroll is a
   * door nobody finds, and `sidebar.spec` #1 needs the complaint and escalation
   * dots visible without anybody hunting for them. `doorsFor` is the same role
   * table the hub and the chords read.
   */
  const worlds = doorsFor(role).filter(
    (door) => door.path !== "/" && !FLOW.some((item) => item.path === door.path),
  );

  return (
    <nav
      data-testid="side-rail"
      data-collapsed={collapsed ? "1" : "0"}
      className="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-4 border border-line-strong bg-surface-app p-1"
    >
      {flow.map((item) => {
        const to =
          item.path === "/review" && orderId !== null ? `/orders/${orderId}/review` : item.path;
        return (
          <Door
            key={item.path}
            path={item.path}
            label={item.label}
            collapsed={collapsed}
            active={pathname === to || pathname.startsWith(`${to}/`)}
            to={to}
          />
        );
      })}

      {worlds.length === 0 ? null : (
        <>
          <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line-strong" />
          <div className="flex flex-wrap gap-1">
            {worlds.map((door) => (
              <Door
                key={door.path}
                path={door.path}
                label={door.label}
                collapsed={collapsed}
                active={pathname === door.path || pathname.startsWith(`${door.path}/`)}
                to={door.path}
              />
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
