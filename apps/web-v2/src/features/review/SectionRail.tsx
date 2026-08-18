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
 * is a table of contents, not a second copy of the sheet — it renders a
 * heading, a page and a count, never a value, so there is exactly one place a
 * value can be wrong.
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
 * THE PAGE REF IS THE SECTION'S OWN CITE (`sectionPageOf`), not a count and not
 * a position. A reviewer deciding whether to jump is asking "which page of the
 * package is that", and the rail can answer it without them leaving the row
 * they are on. It is absent, not zero, when the section has cited nothing yet.
 *
 * IT IS SPELLED `p12` AND SET IN MONO — the dialect `PageChip` and `AsRead`
 * already use for every page ref in the app. It is deliberately NOT a
 * `PageChip`: that is a BUTTON that moves the document pane to a page, and a
 * second one inside an `<a>` would be a control nested in a control, which is
 * invalid markup and announces unpredictably. The rail's whole row is already
 * the navigation; the page is a label on it.
 *
 * ACTIVE FOLLOWS THE SELECTED FIELD, IT IS NOT A CLICK MEMORY. The rail used to
 * hold its own `useState` set on click, so it kept pointing at Judgments while
 * `j`/`k`, a `?field=` deep link or a click in the sheet moved the reviewer into
 * Taxes — a table of contents asserting you are somewhere you left. Selection
 * is URL-owned and one thing owns it; this reads that, and holds no state.
 *
 * Real `<a href="#section-x">` anchors, not a synthetic scroll handler — the
 * browser's own fragment navigation does the scrolling (through the report
 * scroller, which is a scrollable ancestor) and keeps `location.hash` a
 * first-class, bookmarkable pointer into the report, same as `?field=` is for
 * the decision queue.
 */
export function SectionRail({
  fields,
  selectedPath,
}: {
  fields: readonly Field[];
  /** The field the reviewer is on — the rail highlights the section holding it. */
  selectedPath: string;
}) {
  const sections = sectionsOf(fields);
  const active =
    sections.find(([, rows]) => rows.some((f) => f.path === selectedPath))?.[0] ?? null;

  return (
    <nav
      aria-label="Report sections"
      data-testid="section-rail"
      className="flex w-76 flex-none flex-col gap-1 overflow-y-auto border-l border-line-strong bg-surface-panel px-4 py-7"
    >
      <Eyebrow variant="caption" className="px-4 pb-3">
        Jump to section
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
              "flex items-baseline gap-3 rounded-6 px-4 py-3 text-xs leading-body",
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
