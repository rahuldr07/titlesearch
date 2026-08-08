import { cn } from "../../shared/ui/classNames";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * ONE LABELLED GROUP IN THE RAIL — the tracked-caps header and the rows under
 * it. `Sidebar` walks the section array; this draws one entry of it.
 *
 * Split out because `Sidebar` was doing three jobs in one component: the column
 * (width, fold, paper, the ResizeObserver), the brand row, and the anatomy of a
 * group. The third is the one that grew — a header, an optional machine-set
 * reference beside it, a foot rule, a row gap — and it was growing inside a map
 * callback, which is where a component hides until it is too tangled to move.
 *
 * COLLAPSED, THE HEADER IS GONE, NOT ABBREVIATED. At 78px there is no width for
 * a tracked caps label and no useful truncation of one ("THIS OR…"); the rows'
 * own marks carry the grouping, spaced by the column's gap. A header that
 * clipped would be the only clipped text in the rail.
 */
export interface RailSectionProps {
  label: string;
  /** A machine reference set beside the header — the order this flow is about. */
  note?: string;
  /** Pushes this group, and everything after it, to the foot of the rail. */
  foot?: boolean;
  collapsed: boolean;
  children: React.ReactNode;
}

export function RailSection({
  label,
  note,
  foot,
  collapsed,
  children,
}: RailSectionProps) {
  return (
    <div
      /*
       * `gap-1` is the mockup's 2px between rows — small enough that the group
       * still reads as one list, large enough that the active row's wash has an
       * edge instead of bleeding into its neighbours.
       *
       * `mt-auto` claims the column's free space. On a short viewport it
       * collapses to nothing rather than overflowing, which is the correct
       * degradation: the rail scrolls, and the foot group simply stops being at
       * the foot.
       */
      className={cn("flex flex-col gap-1", foot === true && "mt-auto")}
    >
      {collapsed ? null : (
        <Eyebrow as="h2" variant="group" className="px-12 pb-3.5">
          {label}
          {note === undefined ? null : (
            <>
              {" · "}
              {/*
                THE REFERENCE IS SET APART, and the tracking is why. The header
                runs at 0.18em, which is correct for a two-word label and turns
                a hyphenated order number into loose debris. Mono at badge
                tracking with `tnum` keeps `4176034-1` readable as one token —
                it has to survive being read back over a phone.
              */}
              <span className="font-mono tracking-badge tnum">{note}</span>
            </>
          )}
        </Eyebrow>
      )}
      {children}
    </div>
  );
}
