import { useRef, type ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";
import { RailFold } from "./RailFold";
import { RailSection } from "./RailSection";
import { SidebarDoor, type SidebarDoorProps } from "./SidebarDoor";
import { LifecycleRail, type LifecycleStage } from "./LifecycleRail";
import { useForcedCollapse } from "./useForcedCollapse";

/**
 * The collapsible LEFT SIDEBAR (§11) — the navigator, back on the left where
 * the approved design draws it. 216px wide, 78px collapsed; rows are 27.6px
 * expanded (type + padding, not a fixed height) and 44px collapsed.
 *
 * GROUPED SECTIONS (Task 12) — uppercase headers in a fixed order: WORK, THIS
 * ORDER (the numbered `LifecycleRail`), ADMIN, REFERENCE. `AppChrome` decides
 * which sections exist, in what order, which one carries the order reference
 * and which one falls to the foot; this component only walks the array and
 * draws headers + bodies, so the "four headers, in order" invariant is one
 * array, not four hand-written branches that could drift apart.
 *
 * PRESENTATIONAL — no router, no fetch (§6). The smart chrome computes the door
 * set, active marking, attention and the persisted collapse, and passes the
 * account menu in as the `foot` slot. What this component OWNS is pure DOM, not
 * data: the collapse ATTRIBUTE and width, over a base collapse that is the
 * persisted preference (merged upstream with the Review first-mount default) OR
 * the measured lack of room — see `useForcedCollapse` for why the second is
 * measured on the container rather than the window.
 */
export type SidebarDoorItem = Omit<SidebarDoorProps, "collapsed" | "onNavigate">;

interface SectionCommon {
  label: string;
  /**
   * A machine value appended to the header after a middot — the order this flow
   * is about. Set apart in mono at its own tracking because it is a REFERENCE,
   * not a word: `THIS ORDER · 4176034-1` has to survive being read back over a
   * phone, and tracked caps at 0.18em turn a hyphenated number into noise.
   */
  note?: string;
  /**
   * Pushes this section — and everything after it — to the foot of the rail.
   * The mockup's `margin-top:auto` on ADMIN: the work you do sits under the
   * brand, the tools you administer sit at the bottom, and the gap between them
   * is the statement. Set by the chrome, not inferred from the label here.
   */
  foot?: boolean;
}

export type SidebarSection = SectionCommon &
  (
    | { kind: "doors"; doors: readonly SidebarDoorItem[] }
    | { kind: "lifecycle"; stages: readonly LifecycleStage[] }
  );

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (to: string) => void;
  brand: ReactNode;
  sections: readonly SidebarSection[];
  /** Optional — the account menu moved to `OrderStrip` (§11 2026-07-30 revision). */
  foot?: ReactNode;
}

export function Sidebar({ collapsed, onToggle, onNavigate, brand, sections, foot }: SidebarProps) {
  const ref = useRef<HTMLElement>(null);
  // The persisted CHOICE, or the measured lack of room — either folds the rail,
  // and only the first of them is ever written back (`useForcedCollapse`).
  const isCollapsed = useForcedCollapse(ref) || collapsed;

  /*
   * A DARK COLUMN, 2026-08-13, and a hairline of its own light instead of a
   * rule. It was warm paper one tone off the sheet (`--color-surface-sunken`)
   * against `--color-surface-panel` screens — the quietest legible separation
   * the paper ladder has. The approved navigator inverts that: the chrome goes
   * dark so the paper is spent on the WORK, and the rail stops competing with
   * the screen it frames by leaving the paper ladder entirely rather than by
   * sitting one rung down it.
   *
   * ⚠ THE RAIL HAS ITS OWN INK VOCABULARY, and it is not optional. Every colour
   * on this column comes from a `rail-*` token (`tokens.css`, "the navigator's
   * own ink family"): `--color-ink-primary` measures 1.00:1 on this surface —
   * identical luminance, blank, not merely low-contrast. Anything drawn here
   * that reaches for the app's ink tiers disappears, and does so in the one
   * state (a dark column under a light app) nobody screenshots.
   *
   * NO HORIZONTAL PADDING ON THE COLUMN. The rows run full-bleed so their active
   * edge sits on the rail's own margin (see `RailRow`); everything that is not a
   * row carries its own inset instead. The group separators are gone with it —
   * the mockup separates sections with space and a tracked caps label, and a
   * rule between every group turned a six-row flow into six fenced boxes.
   *
   * 216px, ON THE OWNER'S CALL 2026-08-04 (the mockup measures 264, which this
   * held until then). The 24px rhythm is unchanged and still the mockup's.
   *
   * ⚠ 204px IS A MEASURED FLOOR. `products & sign-off` needs 131px beside a mark
   * and a badge: at 203 it truncates, at 204 it does not. That is the defect
   * that moved this column 232 -> 264 originally, and the floor ROSE with the
   * 13 -> 15px type bump the same day — width and type pull against each other,
   * so neither moves without re-measuring the other. The 12px of headroom is
   * deliberate — labels are route data, one copy edit from clipping.
   */
  return (
    <aside
      ref={ref}
      data-testid="side-rail"
      data-collapsed={isCollapsed ? "1" : "0"}
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col gap-12 overflow-y-auto scrollbar-none border-r border-rail-line bg-rail-surface pt-12 pb-13",
        isCollapsed ? "w-39" : "w-108",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-12">
        {isCollapsed ? null : brand}
        <RailFold collapsed={isCollapsed} onToggle={onToggle} />
      </div>

      {sections.map((section) => (
        <RailSection
          key={section.label}
          label={section.label}
          collapsed={isCollapsed}
          {...(section.note === undefined ? {} : { note: section.note })}
          {...(section.foot === undefined ? {} : { foot: section.foot })}
        >
          {section.kind === "lifecycle" ? (
            <LifecycleRail stages={section.stages} collapsed={isCollapsed} onNavigate={onNavigate} />
          ) : (
            section.doors.map((door) => (
              <SidebarDoor key={door.to} {...door} collapsed={isCollapsed} onNavigate={onNavigate} />
            ))
          )}
        </RailSection>
      ))}

      {foot === undefined ? null : (
        <div className="mt-auto border-t border-rail-line px-12 pt-4">{foot}</div>
      )}
    </aside>
  );
}
