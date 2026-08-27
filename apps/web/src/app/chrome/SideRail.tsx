import { Link, useRouterState } from "@tanstack/react-router";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { DOORS, SECTION_ORDER, SECTION_RUBRIC, type RailSection } from "./doors";
import { hasDoor } from "../session/permissions";
import { ProfileBlock } from "./ProfileBlock";
import { cx } from "../../components/ui";

/**
 * THE LEFT RAIL — 240px, on `--color-rail-surface`, full height.
 *
 * INVARIANT 63: it is a full-height COLUMN, not a page-sticky element. It is a
 * flex child of the frame and takes `h-full`; nothing here is `sticky` or
 * `fixed`, because a sticky rail terminates over blank ground the moment the
 * page is taller than the viewport, and the page is never taller than the
 * viewport (INVARIANT 60).
 *
 * INVARIANTS 42/43 — a door outside the role's world is ABSENT, not dimmed.
 * That is why this component takes `rules` and renders nothing for a path the
 * payload does not carry: there is no `disabled` branch below, and there is
 * nowhere to add one without changing the shape of the loop. The payload is
 * the server's projection for THIS role, so a world the reader lacks is not
 * merely hidden here — it never arrived.
 *
 * The rail's own ink family is used throughout (`--color-rail-*`). On this
 * surface `--color-ink-primary` measures 1.03:1 — invisible, not merely low —
 * so a component that reached into the app palette while standing here would
 * render blank rather than slightly wrong.
 */
export function SideRail(props: {
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      data-testid="side-rail"
      aria-label="Screens"
      className="flex h-full w-120 shrink-0 flex-col justify-between overflow-hidden bg-rail-surface"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-12 overflow-y-auto p-10">
        <BrandMark />
        {SECTION_ORDER.map((section) => (
          <Section
            key={section}
            section={section}
            rules={props.rules}
            pathname={pathname}
          />
        ))}
      </div>
      <ProfileBlock />
    </nav>
  );
}

/** Rule 7: flat brand mark, no gradient, typed "TF" — never an asset. */
function BrandMark() {
  return (
    <div className="flex items-center gap-6 px-6 pt-6 pb-2">
      <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-surface-panel text-label font-bold leading-flat text-rail-surface">
        TF
      </span>
      <span className="text-body font-bold leading-flat tracking-tight text-surface-panel">
        TitlePipe
      </span>
    </div>
  );
}

function Section(props: {
  readonly section: RailSection;
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
  readonly pathname: string;
}) {
  const doors = DOORS.filter(
    (door) => door.section === props.section && hasDoor(props.rules, door.path),
  );
  // A section whose every door is outside this world is ABSENT too — a rubric
  // over nothing still names a world the reader may not enter.
  if (doors.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="px-6 pb-2 text-label font-bold uppercase leading-flat tracking-caps text-rail-ink-muted">
        {SECTION_RUBRIC[props.section]}
      </h2>
      {doors.map((door) => {
        // `/` matches exactly; every other door matches its prefix, which is
        // what authz.ts:50 says the path means.
        const active =
          door.path === "/"
            ? props.pathname === "/"
            : props.pathname.startsWith(door.path);
        return (
          <Link
            key={door.path}
            to={door.path}
            data-testid={`rail-door-${door.path}`}
            className={cx(
              "tp-state flex h-16 items-center rounded-md px-6 text-meta leading-flat",
              active
                ? "bg-rail-line font-semibold text-rail-accent"
                : "font-medium text-rail-ink hover:bg-rail-line",
            )}
          >
            {door.label}
          </Link>
        );
      })}
    </div>
  );
}
