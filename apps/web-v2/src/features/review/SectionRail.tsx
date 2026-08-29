import type { Field } from "@titlepipe/contract";
import {
  SECTION_HEADING,
  needsYouCountOf,
  sectionAnchor,
  sectionPageOf,
  sectionsOf,
} from "./reportSections";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * THE INSTRUMENTS IN THE PACKAGE — jump to a section of the draft, and see
 * which page of the package it was read from. Nothing else.
 *
 * IT IS DOCKED UNDER THE DOCUMENT, not beside the draft. It used to be a
 * column to the RIGHT of the report scroller, which is where the export puts
 * it — correct while the document was the left half of the frame and the draft
 * the right. With the draft now the primary column and the viewer beside it,
 * that placement would drop a table of contents down the MIDDLE of the screen,
 * between the document it indexes and the sheet it links into.
 *
 * It belongs with the document because of what it actually says. Every row is a
 * section AND the page that section starts on: it is a map of the PACKAGE as
 * much as of the draft, and it answers "which instrument is on which page" —
 * a question asked while looking at a page, exactly like the coverage spine it
 * now sits above.
 *
 * This is a STATED DEVIATION from the export's `flex:0 0 152px` rail (`:1068`),
 * not a match. The export's two-pane split is not this screen's split any more.
 *
 * IT IS A TABLE OF CONTENTS, NOT A SECOND COPY OF THE SHEET — it renders a
 * heading, a page and a count, never a value, so there is exactly one place a
 * value can be wrong.
 *
 * SAME GROUPING AS THE SHEET, on purpose (`reportSections.sectionsOf`). A rail
 * that derives its own split from `field.path` could drift from the sheet's —
 * different section count, different order — and a jump link is only useful if
 * it lands where the reviewer expects to see the section it named.
 *
 * THE BADGE COUNTS STILL-OPEN FIELDS (`needs_review` or `escalated`), read
 * straight off server `state` — never confidence, never `value === null`. It
 * answers "where is the open work", not "how many fields are in this section":
 * a section with twelve settled fields and zero open ones shows no badge at
 * all.
 *
 * THE PAGE REF IS THE SECTION'S OWN CITE (`sectionPageOf`), spelled `p12` in
 * mono — the dialect `PageChip` and `AsRead` use everywhere else. It is
 * deliberately NOT a `PageChip`: that is a BUTTON that moves the viewer, and a
 * control nested inside this `<a>` would be invalid markup that announces
 * unpredictably. The row IS the navigation; the page is a label on it. Absent,
 * never `p1`, when the section has cited nothing yet — a placeholder there
 * would invent a citation.
 *
 * ACTIVE FOLLOWS THE SELECTED FIELD, IT IS NOT A CLICK MEMORY. The rail used to
 * hold its own `useState` set on click, so it kept pointing at Judgments while
 * `j`/`k`, a `?field=` deep link or a click in the sheet moved the reviewer
 * into Taxes — a table of contents asserting you are somewhere you left.
 * Selection is URL-owned and one thing owns it; this reads that, and holds no
 * state.
 *
 * Real `<a href="#section-x">` anchors, not a synthetic scroll handler — the
 * browser's own fragment navigation does the scrolling (through the draft's
 * scroller, which is a scrollable ancestor of the anchor) and keeps
 * `location.hash` a first-class, bookmarkable pointer into the report, same as
 * `?field=` is for the decision queue.
 */
export function SectionRail({
  fields,
  selectedPath,
}: {
  fields: readonly Field[];
  /** The field the reviewer is on — the rail marks the section holding it. */
  selectedPath: string;
}) {
  const sections = sectionsOf(fields);
  const active =
    sections.find(([, rows]) => rows.some((f) => f.path === selectedPath))?.[0] ?? null;

  return (
    <nav
      aria-label="Report sections"
      data-testid="section-rail"
      className="flex max-h-72 flex-none flex-col gap-1 overflow-y-auto border-t border-line-strong bg-surface-panel px-4 py-5"
    >
      <Eyebrow variant="caption" className="px-4 pb-3">
        Instruments
      </Eyebrow>

      {sections.map(([section, rows]) => {
        const need = needsYouCountOf(rows);
        const page = sectionPageOf(rows);
        const isActive = active === section;
        return (
          <a
            key={section}
            href={`#${sectionAnchor(section)}`}
            data-testid={`section-link-${section}`}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex items-baseline gap-3 rounded-6 px-4 py-2 text-xs leading-body",
              isActive
                ? "bg-action-surface font-semibold text-action-ink"
                : "text-ink-secondary",
            )}
          >
            <span className="min-w-0 flex-1">
              {SECTION_HEADING[section] ?? section.replaceAll("_", " ")}
            </span>
            {page === null ? null : (
              <span className="font-mono text-tiny text-ink-muted">p{page}</span>
            )}
            {need > 0 ? (
              <Chip tone="attend" shape="pill" size="micro" bordered>
                {need}
              </Chip>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
