import { cx } from "../../components/ui";
import type { Section } from "./fieldNaming";

/**
 * THE 200px SECTION RAIL — the workstation's left pane, measured off
 * `reference-app.html`'s `isReview` (`200px` fixed, then `flex:1` for the
 * decision column, then the scan pane).
 *
 * ══ IT LISTS THE SERVER'S SECTIONS IN THE SERVER'S ORDER ═══════════════════
 *
 * `sectionsOf` buckets `fields` by path prefix and preserves the pipeline's
 * order, and says why: "re-ordering it by state or by name would be the browser
 * deciding what a reviewer meets first." This pane renders that order and adds
 * nothing to it — no sort, no float-to-top, no completion sort.
 *
 * ══ THE MARK IS A FACT, NOT A JUDGEMENT ════════════════════════════════════
 *
 * `Section.flagged` records "whether the SERVER has anything queued here. Read,
 * never computed." So a section shows a mark when the server has queued work in
 * it, and that is the whole rule — rule 6's "one status signal per row" spent
 * on weight and a dot, with no capsule, because a section is not a moment of
 * record.
 *
 * The count beside it is `fields.length` and that is legitimate HERE, where it
 * is not a census: it is how many rows this pane will scroll past, a fact about
 * the list on screen rather than a claim about the order. INVARIANT 5's concern
 * is a server-owned figure being re-derived, and the field list is not scoped
 * by permission the way `LifecycleStage.count` is — `OrderFieldsResponse` hands
 * over the fields it hands over.
 */
export function SectionRail(props: {
  readonly sections: readonly Section[];
  readonly activeSection: string | null;
  readonly onSelect: (sectionId: string) => void;
}) {
  return (
    <nav
      aria-label="Report sections"
      className="flex w-100 shrink-0 flex-col overflow-y-auto border-r border-line-strong bg-surface-panel"
    >
      <h2 className="border-b border-line-subtle px-6 py-5 text-label font-semibold leading-flat text-ink-faint">
        Sections
      </h2>
      <ul className="flex flex-col">
        {props.sections.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => props.onSelect(section.id)}
              aria-current={section.id === props.activeSection ? "true" : undefined}
              data-flagged={section.flagged}
              className={cx(
                "tp-state flex w-full items-center gap-4 border-b border-line-faint px-6 py-5 text-left",
                section.id === props.activeSection
                  ? "bg-action-surface"
                  : "hover:bg-row-hover",
              )}
            >
              {/*
               * Rule 7's glyph vocabulary: ◆ is the attend mark. A section the
               * server has queued work in carries it; one it does not carries a
               * spacer of the same width so the titles stay on one column.
               */}
              <span
                aria-hidden
                className={cx(
                  "w-4 shrink-0 text-label leading-flat",
                  section.flagged ? "text-state-attend" : "text-transparent",
                )}
              >
                ◆
              </span>
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-meta leading-close",
                  section.flagged
                    ? "font-semibold text-ink-primary"
                    : "text-ink-secondary",
                )}
              >
                {section.title}
              </span>
              <span className="shrink-0 text-label leading-flat tabular-nums text-ink-faint">
                {section.fields.length}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
