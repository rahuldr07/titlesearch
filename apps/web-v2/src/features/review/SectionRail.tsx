import { useState } from "react";
import type { Field } from "@titlepipe/contract";
import { SECTION_HEADING, needsYouCountOf, sectionAnchor, sectionsOf } from "./reportSections";
import { Card, CardBody } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * JUMP TO A SECTION OF THE DRAFT REPORT — nothing else.
 *
 * The design pairs this with the decision dock for a reason: the reviewer
 * works the queue field-by-field, but the draft sheet below it is a full
 * document, and "scroll until you find Judgments" is not a plan on a 20-field
 * order. This is a table of contents, not a second copy of the sheet — it
 * renders a heading and a count, never a value, so there is exactly one place
 * a value can be wrong.
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
 * browser's own fragment navigation does the scrolling and keeps `location.hash`
 * a first-class, bookmarkable pointer into the report, same as `?field=` is for
 * the decision queue (`ReviewScreen`'s own selection convention).
 */
export function SectionRail({ fields }: { fields: readonly Field[] }) {
  const [active, setActive] = useState<string | null>(null);
  const sections = sectionsOf(fields);

  return (
    <Card data-testid="section-rail">
      <CardBody className="flex flex-col gap-2">
        <Eyebrow variant="caption">Jump to section</Eyebrow>
        <nav aria-label="Report sections" className="flex flex-col gap-1">
          {sections.map(([section, rows]) => {
            const need = needsYouCountOf(rows);
            return (
              <a
                key={section}
                href={`#${sectionAnchor(section)}`}
                data-testid={`section-link-${section}`}
                aria-current={active === section ? "true" : undefined}
                onClick={() => setActive(section)}
                className={cn(
                  "flex items-center gap-3 rounded-6 px-3 py-2 text-xs",
                  active === section
                    ? "bg-action-surface font-semibold text-action-ink"
                    : "text-ink-secondary",
                )}
              >
                <span className="flex-1">
                  {SECTION_HEADING[section] ?? section.replaceAll("_", " ")}
                </span>
                {need > 0 ? (
                  <Chip tone="attend" shape="mono" size="micro">
                    {need}
                  </Chip>
                ) : null}
              </a>
            );
          })}
        </nav>
      </CardBody>
    </Card>
  );
}
