import { Link, useRouterState } from "@tanstack/react-router";
import { canAccess } from "@titlepipe/contract";
import { useSession } from "../shared/session";
import { cn } from "../shared/ui/classNames";

/**
 * The screen menu — the design's replacement for the deleted side rail.
 *
 * It runs along the top rather than down the side, and it does not fold. That
 * is the design's answer to the rail question: navigation is a strip you read
 * once, not a panel that competes with the document for width. On the review
 * workstation the document is the work, and a rail was taking 240px from it.
 *
 * A ROLE'S WORLD IS ABSENT, NOT DIMMED. The same `canAccess` table the server
 * gates with decides what appears here, so there is no greyed door inviting
 * somebody to ask for access to a screen that would refuse them anyway.
 * Screens with no authorisation row are open to everyone by construction.
 */
const ITEMS: readonly { path: string; label: string }[] = [
  { path: "/queue", label: "Queue" },
  { path: "/overview", label: "Overview" },
  { path: "/ingest", label: "Upload" },
  { path: "/questions", label: "Questions" },
  { path: "/processing", label: "Processing" },
  { path: "/completeness", label: "Completeness" },
  { path: "/review", label: "Review" },
  { path: "/delivered", label: "Delivered" },
  { path: "/gallery", label: "States" },
];

/** Authorisation rows exist for a subset; the rest are unrestricted screens. */
const GATED = new Set(["/queue", "/review"]);

export function ScreenMenu({ orderId }: { orderId: string | null }) {
  const role = useSession((s) => s.role);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visible = ITEMS.filter(
    (item) => !GATED.has(item.path) || canAccess(role, item.path),
  );

  return (
    <nav
      data-testid="screen-menu"
      className="flex min-w-0 flex-1 gap-1 rounded-4 border border-line-strong bg-surface-app p-1"
    >
      {visible.map((item) => {
        const target =
          item.path === "/review" && orderId !== null
            ? `/orders/${orderId}/review`
            : item.path;
        const active = pathname === target || pathname.startsWith(`${target}/`);
        return (
          <Link
            key={item.path}
            to={target}
            data-testid={`menu-${item.path}`}
            className={cn(
              "shrink-0 rounded-3 px-4 py-2 text-xs font-medium",
              active ? "bg-surface-panel text-ink-primary" : "text-ink-secondary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
