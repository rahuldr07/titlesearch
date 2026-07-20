import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { useSession } from "../session";
import { canAccess } from "../nav";

/**
 * Shared header per the .dc.html pattern: caps screen title, user, date on the
 * left; contextual nav links on the right. Each screen passes the links its
 * .dc.html shows — there is deliberately no global all-screens menu here.
 * Role-locked entry (§0.7): links outside the session role's world are not
 * dimmed, they are ABSENT — the door doesn't exist (nav.ts owns the worlds).
 */
export interface NavLink {
  label: string;
  to: LinkProps["to"];
  params?: LinkProps["params"];
}

const barDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
}).format(new Date());
const barTime = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date());

/**
 * Screen title that doubles as the mouse path home. The no-menu law stands —
 * this is one link, not a menu — but a mouse-only abstractor must never be
 * stranded on a screen with no door back to the map. Roles without "/"
 * (typists) get plain text: the door doesn't exist, so neither does the link.
 */
export function HomeTitle({
  title,
  className,
}: {
  title: string;
  className: string;
}) {
  const role = useSession((s) => s.role);
  return canAccess(role, "/") ? (
    <Link
      to="/"
      data-testid="screen-title"
      title="home — the map, live"
      className={`${className} no-underline`}
    >
      {title}
    </Link>
  ) : (
    <div data-testid="screen-title" className={className}>
      {title}
    </div>
  );
}

export function TopBar({
  title,
  links,
  children,
}: {
  title: string;
  links?: NavLink[];
  children?: ReactNode;
}) {
  const name = useSession((s) => s.name);
  const role = useSession((s) => s.role);
  return (
    <div className="flex flex-none items-center justify-between border-b border-line bg-surface px-[18px] py-[10px]">
      <div className="flex items-baseline gap-[14px]">
        <HomeTitle
          title={title}
          className="text-[12px] font-bold tracking-[.12em] text-label uppercase"
        />
        <div className="text-[13px] font-semibold">{name}</div>
        <div className="text-[12px] text-ink-dim">
          {barDate} · {barTime}
        </div>
        {children}
      </div>
      {links && links.length > 0 && (
        <div className="flex gap-[14px] text-[12px] font-semibold">
          {links
            .filter((l) => canAccess(role, String(l.to)))
            .map((l) => (
              <Link
                key={l.label}
                to={l.to}
                {...(l.params !== undefined ? { params: l.params } : {})}
                className="no-underline"
              >
                {l.label}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}

/** Full-height screen frame: 100vh flex column, page background. */
export function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-bg font-sans text-ink">
      {children}
    </div>
  );
}
