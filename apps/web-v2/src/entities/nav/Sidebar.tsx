import { useRef, type ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";
import { RailSection } from "./RailSection";
import { SidebarDoor, type SidebarDoorProps } from "./SidebarDoor";
import { LifecycleRail, type LifecycleStage } from "./LifecycleRail";
import { useForcedCollapse } from "./useForcedCollapse";

/**
 * The collapsible LEFT SIDEBAR (§11) — the navigator, back on the left where
 * the approved design draws it. 264px wide, 78px collapsed; rows are 27.6px
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
   * WARM PAPER ONE TONE OFF THE SHEET, and a hairline instead of a rule. The
   * mockup's rail is `--sheet-dim` against `--card` panels, the quietest legible
   * separation the paper ladder has: the navigator is furniture, and a
   * panel-white column fenced by the strong line competed with the screen it
   * frames.
   *
   * NO HORIZONTAL PADDING ON THE COLUMN. The rows run full-bleed so their active
   * edge sits on the rail's own margin (see `RailRow`); everything that is not a
   * row carries its own inset instead. The group separators are gone with it —
   * the mockup separates sections with space and a tracked caps label, and a
   * rule between every group turned a six-row flow into six fenced boxes.
   *
   * 264px AND A 24px RHYTHM, the mockup's measurements. It was 232/20, which is
   * not a small difference here: `products & sign-off` at 13px does not fit
   * 232px beside a mark and a badge, so the rail's longest label was the one
   * that truncated. The column now sizes to its content instead of clipping it.
   */
  return (
    <aside
      ref={ref}
      data-testid="side-rail"
      data-collapsed={isCollapsed ? "1" : "0"}
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col gap-12 overflow-y-auto border-r border-line-subtle bg-surface-sunken pt-12 pb-13",
        isCollapsed ? "w-39" : "w-132",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-12">
        {isCollapsed ? null : brand}
        {/*
          THE FOLD, AND IT RECEDES. The mockup has no such control — it draws one
          state — but the fold is a product feature (`sidebar.spec`: Review opens
          collapsed, `[` toggles it, the choice persists server-side), so it
          stays and instead stops looking like one of the doors. It was a
          bordered box, which in a rail whose marks are now borderless was the
          only chrome-drawn rectangle on the column and read as the most
          important thing on it.
        */}
        <button
          type="button"
          data-testid="rail-toggle"
          aria-pressed={isCollapsed}
          aria-label={isCollapsed ? "Expand the navigator" : "Fold the navigator"}
          onClick={onToggle}
          className="shrink-0 rounded-3 px-2 py-1 font-mono text-sm text-ink-muted hover:bg-surface-panel hover:text-ink-secondary"
        >
          {isCollapsed ? "]" : "["}
        </button>
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
        <div className="mt-auto border-t border-line-subtle px-12 pt-4">{foot}</div>
      )}
    </aside>
  );
}
