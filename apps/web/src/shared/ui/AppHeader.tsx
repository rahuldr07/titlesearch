import { Link, useRouterState } from "@tanstack/react-router";
import { canAccess } from "@titlepipe/contract";
import { DOORS } from "../../doors";
import { useSession } from "../../session";
import { useDoorSignals } from "../../useDoorSignals";

/**
 * The app chrome, built to design-mock: a 60px top header, and NO SIDEBAR.
 * The nav is a horizontal tab strip inside the header; the screen owns
 * everything below it.
 *
 * This replaces the old side rail and is why three rail invariants were retired
 * rather than rewritten — see docs/frontend/decisions.md D4. The rules they
 * guarded either survive here (role-locked doors are ABSENT not dimmed; no
 * counts, ever) or governed an affordance that no longer exists (fold,
 * persisted collapse).
 *
 * DELIBERATE ADAPTATION, and the one place this is not literally as drawn:
 * design-mock's header also carries per-order field counts and the order's
 * status stamp. It can, because that prototype is always inside one order. In a
 * real multi-screen app a global header cannot show order-scoped numbers — on
 * the dashboard or the rulebook there is no order to count. Those belong to the
 * order screens and already live on Review. Putting them here would also mean
 * computing them client-side, which is conflict C1.
 *
 * The order REF does appear, because it is genuinely useful context and is read
 * from the route rather than derived.
 */
export function AppHeader() {
  const role = useSession((s) => s.role);
  const name = useSession((s) => s.name);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Order-scoped screens carry their ref in the path. Read, never derived.
  const orderRef = /^\/orders\/([^/]+)/.exec(pathname)?.[1] ?? null;

  // Role-locked doors are ABSENT, not dimmed (orphan O13). A greyed-out tab
  // would advertise a screen this role's permission projection never mentions.
  const doors = DOORS.filter((d) => canAccess(role, d.to));

  /*
   * Attention dots. design-mock draws its nav plain, and this is the one thing
   * added to it — because "amber pulls, quiet recedes; go where the attention is"
   * is product behaviour (HANDOFF §4), not decoration. Without it the navigator
   * cannot route anyone anywhere and the reviewer has to go looking.
   *
   * DOTS, NEVER COUNTS. A number here would be a backlog figure in permanent
   * chrome, which is a throughput counter wearing a different hat — the exact
   * thing forbidden everywhere (§0.4). A dot says "something is here"; a count
   * says "you are behind".
   */
  const { signalOf } = useDoorSignals();

  const initials = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header
      data-testid="app-header"
      className="z-20 flex h-[60px] flex-none items-center gap-4 border-b border-line-strong bg-surface-panel px-[18px]"
    >
      {/* wordmark — three stacked rules, a document seen edge-on */}
      <Link to="/" className="flex items-center gap-3 no-underline">
        <span className="relative block h-[26px] w-[26px] flex-none rounded-xs border-2 border-page-ref">
          <span className="absolute inset-x-[3px] top-[4px] block h-[2px] bg-page-ref" />
          <span className="absolute top-[9px] right-[6px] left-[3px] block h-[2px] bg-page-ref opacity-70" />
          <span className="absolute inset-x-[3px] bottom-[4px] block h-[2px] bg-page-ref opacity-40" />
        </span>
        <span className="block">
          <span className="block text-lg font-bold tracking-[.14em] text-ink-primary">
            TITLEPIPE
          </span>
          <span className="-mt-px block text-tiny tracking-[.1em] text-ink-muted uppercase">
            Abstractor Review
          </span>
        </span>
      </Link>

      {orderRef === null ? null : (
        <>
          <span className="h-[26px] w-px flex-none bg-line-strong" />
          <span className="flex flex-col gap-px">
            <span className="text-micro tracking-eyebrow text-ink-muted uppercase">
              Order
            </span>
            <span
              data-testid="header-order-ref"
              className="font-mono text-md font-medium text-ink-primary"
            >
              {orderRef}
            </span>
          </span>
        </>
      )}

      <nav
        data-testid="header-nav"
        className="ml-2 flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-md border border-line-strong bg-surface-app p-[3px]"
      >
        {doors.map((d) => {
          const active =
            d.to === "/"
              ? pathname === "/"
              : pathname === d.to || pathname.startsWith(`${d.to}/`);
          const signal = signalOf(d.to);
          return (
            <Link
              key={d.to}
              to={d.to}
              data-testid={`nav-${d.to}`}
              data-active={active ? "1" : "0"}
              // the signal's WORDS are the tooltip, never rendered inline —
              // that is what keeps a count out of the chrome
              title={signal === null ? d.desc : signal.text}
              className={`relative flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm font-medium whitespace-nowrap no-underline ${
                active
                  ? "bg-surface-panel text-page-ref"
                  : "text-ink-secondary hover:bg-surface-panel"
              }`}
            >
              {d.label}
              {signal === null ? null : (
                <span
                  data-testid={`nav-dot-${d.to}`}
                  aria-label={signal.text}
                  className={`inline-block h-1.5 w-1.5 flex-none rounded-full ${
                    signal.tone === "act"
                      ? "bg-state-halt"
                      : signal.tone === "attend"
                        ? "bg-state-attend"
                        : "bg-state-settled"
                  }`}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <Link
        to="/account"
        data-testid="header-account"
        className="ml-auto flex flex-none items-center gap-2 rounded-md border border-line-strong bg-surface-panel py-[5px] pr-[9px] pl-[5px] no-underline"
      >
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-page-ref font-mono text-xs font-semibold text-ink-on-action">
          {initials}
        </span>
        <span className="block text-left leading-tight">
          <span className="block text-xs font-semibold text-ink-primary">
            {name}
          </span>
          <span className="block text-micro tracking-[.08em] text-ink-muted uppercase">
            {role}
          </span>
        </span>
      </Link>
    </header>
  );
}
