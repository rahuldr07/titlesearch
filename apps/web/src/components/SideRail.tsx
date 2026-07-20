import { Link, useRouterState } from "@tanstack/react-router";
import { canAccess } from "../nav";
import { DOOR_GROUPS, type Door } from "../doors";
import { useRail } from "../railStore";
import { useSession } from "../session";
import { useDoorSignals, type Signal, type Tone } from "../useDoorSignals";

/**
 * The side rail — a persistent role-filtered navigator. It is the one place the
 * "no global menu" pattern is deliberately relaxed (owner call), with the laws
 * it guarded kept intact: doors OUTSIDE the role's world are absent, not dimmed
 * (§0.7, same `canAccess` the router enforces); typists get no rail (they live
 * only under /blind/*, where RootLayout doesn't mount it, so its live-signal
 * hook never fires a GET from the capture seat); and it is a navigator, not a
 * dashboard — each door shows its attention DOT (amber pulls, red acts), never
 * a count. The numbers stay on the hub.
 *
 * Visual model (premium, low-contrast): color-only interactions, one crisp
 * active signal (a 2px ink bar + a whisper of tint + full-ink weight — amber
 * and red stay reserved for attention, never spent on "you are here"), an
 * instant hover, a calm 180ms width collapse, and a keyboard-visible focus
 * ring. The keyboard identity is the icon: the `g <key>` chord chip IS each
 * door's glyph, so the collapsed rail stays a column of live shortcuts.
 */

const dotClass: Record<Tone, string> = {
  attend: "bg-attend-border",
  act: "bg-act railpulse",
  quiet: "",
};

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "•"
  );
}

function RailDoor({
  door,
  signal,
  active,
  collapsed,
}: {
  door: Door;
  signal: Signal | null;
  active: boolean;
  collapsed: boolean;
}) {
  const hot = signal !== null && signal.tone !== "quiet";
  return (
    <Link
      to={door.to}
      data-testid={`rail-door-${door.to}`}
      data-active={active ? "1" : "0"}
      title={collapsed ? door.label : undefined}
      className={`group relative mx-[8px] flex h-[32px] items-center gap-[10px] rounded-[6px] no-underline transition-colors duration-[80ms] focus-visible:shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-action-border)] focus-visible:outline-none ${
        collapsed ? "px-[7px]" : "px-[10px]"
      } ${active ? "bg-surface-dim" : "hover:bg-row-hover"}`}
    >
      {active && (
        <span className="absolute top-[6px] bottom-[6px] left-0 w-[2px] rounded-r-[2px] bg-ink-secondary" />
      )}
      <b
        className={`flex-none rounded-chip border px-[5px] py-px font-mono text-[10.5px] transition-colors duration-[80ms] ${
          active
            ? "border-line-strong bg-line-light text-ink-secondary"
            : "border-line-mid bg-surface-dim text-ink-dim group-hover:text-ink-secondary"
        }`}
      >
        {door.key}
      </b>
      <span
        className={`min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[.04em] transition-opacity duration-150 ${
          collapsed ? "opacity-0" : "opacity-100"
        } ${active ? "text-ink" : "text-label group-hover:text-ink-secondary"}`}
      >
        {door.label}
      </span>
      {hot && (
        <span
          data-testid={`rail-dot-${door.to}`}
          title={signal.text}
          className={`absolute h-[6px] w-[6px] rounded-full ${dotClass[signal.tone]} ${
            collapsed
              ? "top-[7px] right-[8px]"
              : "top-1/2 right-[10px] -translate-y-1/2"
          }`}
        />
      )}
    </Link>
  );
}

export function SideRail() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const role = useSession((s) => s.role);
  const name = useSession((s) => s.name);
  const collapsed = useRail((s) => s.collapsed);
  const toggle = useRail((s) => s.toggle);
  const { doors, signalOf } = useDoorSignals();

  // Defense in depth: RootLayout already skips mounting under /blind/*, so the
  // hook above never runs there. This guard keeps the rail honest even if that
  // ever changes — the capture seat has no navigator.
  if (path.startsWith("/blind/")) return null;
  if (doors.length === 0) return null;

  // Longest matching prefix wins, so /bench/results lights its own door, not
  // the shorter /bench. Review (/orders/…) matches nothing — nothing lit.
  const activeTo = doors
    .filter((d) => path === d.to || path.startsWith(`${d.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to;

  const homeIsDoor = canAccess(role, "/");
  const inGroup = (g: Door["group"]) => doors.filter((d) => d.group === g);
  const mainGroups = DOOR_GROUPS.filter((g) => g.group !== "account");
  const accountDoors = inGroup("account");

  return (
    <nav
      data-testid="side-rail"
      data-collapsed={collapsed ? "1" : "0"}
      className={`flex h-screen flex-none flex-col border-r border-line bg-surface transition-[width] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
        collapsed ? "w-[52px]" : "w-[240px]"
      }`}
    >
      {/* header — brand home, collapse toggle */}
      <div
        className={`flex flex-none items-center border-b border-hairline px-[10px] py-[11px] ${
          collapsed ? "flex-col gap-[9px]" : "justify-between"
        }`}
      >
        {homeIsDoor ? (
          <Link
            to="/"
            data-testid="rail-home"
            title="home — the map, live"
            className={`text-label no-underline transition-colors hover:text-ink ${
              collapsed
                ? "text-[15px] leading-none"
                : "text-[12px] font-bold tracking-[.14em]"
            }`}
          >
            {collapsed ? "⌂" : "TITLEPIPE"}
          </Link>
        ) : (
          <span className="text-[12px] font-bold tracking-[.14em] text-label">
            {collapsed ? "TP" : "TITLEPIPE"}
          </span>
        )}
        <button
          type="button"
          data-testid="rail-toggle"
          onClick={toggle}
          title={collapsed ? "expand rail  [" : "fold rail  ["}
          aria-label={collapsed ? "expand rail" : "fold rail"}
          className="cursor-pointer rounded-btn border-none bg-transparent px-[3px] text-[13px] leading-none text-ink-faint transition-colors hover:text-ink-secondary"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* the doors, grouped by pipeline stage */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-[6px]">
        {mainGroups.map((g, gi) => {
          const groupDoors = inGroup(g.group);
          if (groupDoors.length === 0) return null;
          return (
            <div key={g.group} className={gi > 0 ? "mt-[10px]" : ""}>
              {g.header !== null &&
                (collapsed ? (
                  gi > 0 && (
                    <div className="mx-[12px] mb-[8px] border-t border-hairline" />
                  )
                ) : (
                  <div className="px-[18px] pt-[6px] pb-[5px] text-[10px] font-bold tracking-[.09em] text-ink-faint uppercase">
                    {g.header}
                  </div>
                ))}
              <div className="flex flex-col gap-[2px]">
                {groupDoors.map((d) => (
                  <RailDoor
                    key={d.to}
                    door={d}
                    signal={signalOf(d.to)}
                    active={d.to === activeTo}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* account — pinned last, headerless, above the identity footer */}
      {accountDoors.length > 0 && (
        <div className="flex-none border-t border-hairline py-[6px]">
          {accountDoors.map((d) => (
            <RailDoor
              key={d.to}
              door={d}
              signal={signalOf(d.to)}
              active={d.to === activeTo}
              collapsed={collapsed}
            />
          ))}
        </div>
      )}

      {/* identity footer */}
      <div
        className={`flex flex-none items-center border-t border-hairline px-[10px] py-[10px] ${
          collapsed ? "justify-center" : "gap-[9px]"
        }`}
      >
        <span
          title={collapsed ? `${name} · ${role}` : undefined}
          className="flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full border border-line-strong bg-line-light text-[10px] font-semibold text-ink-secondary"
        >
          {initialsOf(name)}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12px] font-semibold text-ink-body">
              {name}
            </div>
            <div className="text-[10.5px] text-ink-faint">
              <span className="text-ink-dim">{role}</span> ·{" "}
              <b className="font-mono">?</b> map · <b className="font-mono">[</b>{" "}
              fold
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
