import { useState } from "react";
import type { Field } from "@titlepipe/contract";
import { SECTION_HEADING, needsYouCountOf, sectionAnchor, sectionsOf } from "./reportSections";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * JUMP TO A SECTION OF THE DRAFT REPORT — nothing else.
 *
 * IT IS A COLUMN INSIDE THE RIGHT PANE, NOT A THIRD TOP-LEVEL ONE. The export
 * puts it at `flex:0 0 152px` with its own left rule, beside the report
 * scroller (`:1068`) — both children of the fields pane. Promoting it to a
 * screen-level column starved the two panes either side of it and pushed the
 * sheet's values out of their rows. `w-76` is that 152px on the 2px base.
 *
 * The design pairs this with the decision dock for a reason: the reviewer works
 * the queue field-by-field, but the draft sheet below it is a full document,
 * and "scroll until you find Judgments" is not a plan on a 20-field order. This
 * is a table of contents, not a second copy of the sheet — it renders a heading
 * and a count, never a value, so there is exactly one place a value can be
 * wrong.
 *
 * SAME GROUPING AS THE SHEET, on purpose (`reportSections.sectionsOf`). A rail
 * that derives its own split from `field.path` could drift from the sheet's —
 * different section count, different order — and a jump link is only useful
 * if it lands where the reviewer expects to see the section it named.
 *
 * The BADGE COUNTS STILL-OPEN FIELDS (`needs_review` or `escalated`), read
 * straight off server `state` — never confidence, never `value === null`. It
 * answers "where is the open work", not "how many fields are in this
 * section": a section with twelve settled fields and zero open ones shows no
 * badge at all.
 *
 * Real `<a href="#section-x">` anchors, not a synthetic scroll handler — the
 * browser's own fragment navigation does the scrolling (through the report
 * scroller, which is a scrollable ancestor) and keeps `location.hash` a
 * first-class, bookmarkable pointer into the report, same as `?field=` is for
 * the decision queue.
 */
const MOCKUP_LABELS: Record<string, string> = {
  deed: "Vesting deed",
  mortgages: "Security instr.",
  assignment: "Assignment",
  judgments: "Judgment",
  assessment: "Tax receipt",
};

export function SectionRail({ fields, selectedPath }: { fields: readonly Field[], selectedPath: string }) {
  const sections = sectionsOf(fields);
  
  // Find which section contains the currently selected field
  const activeSection = sections.find(([_, rows]) => 
    rows.some(f => f.path === selectedPath)
  )?.[0];

  return (
    <nav
      aria-label="Instruments"
      data-testid="section-rail"
      className="flex w-full flex-none flex-col py-2"
    >
      <Eyebrow variant="caption" className="px-4 pb-2 mb-1 tracking-widest text-[#A09D96]">
        INSTRUMENTS
      </Eyebrow>

      {sections.map(([section, rows]) => {
        const isActive = activeSection === section;
        const shortLabel = MOCKUP_LABELS[section] ?? SECTION_HEADING[section] ?? section.replaceAll("_", " ");
        
        return (
          <a
            key={section}
            href={`#${sectionAnchor(section)}`}
            data-testid={`section-link-${section}`}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-1.5 text-[13px] rounded-md cursor-pointer mb-0.5",
              isActive
                ? "bg-[#EBE5D9] text-ink-primary font-medium"
                : "text-ink-primary hover:bg-black/5",
            )}
          >
            <span className={cn("text-[9px] w-2", isActive ? "text-ink-primary" : "text-ink-muted")}>
              {isActive ? "▾" : "▸"}
            </span>
            <span className="min-w-0 flex-1">
              {shortLabel}
            </span>
            <span className="text-xs text-ink-muted">
              pg {rows[0]?.source_page ?? 1}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
