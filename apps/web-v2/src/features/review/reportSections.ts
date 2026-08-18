import type { Field } from "@titlepipe/contract";

/**
 * A field the pipeline ever sent to a person — pending or already decided.
 * Shared by `DecisionDock` (the meter) and `FinalizeBar` (the gate) so the two
 * surfaces count the exact same set of fields; each used to redeclare this
 * verbatim.
 */
export const DECISION_STATES = new Set<Field["state"]>([
  "needs_review",
  "confirmed",
  "corrected",
  "escalated",
]);

/**
 * A field that is still WAITING on a person — queued, or sent up and not yet
 * answered. The subset of `DECISION_STATES` that has not been decided.
 *
 * The two sets are not interchangeable. `DECISION_STATES` is how much work this
 * order ever contained — the meter's denominator, and the set "rest of the
 * queue" is drawn from (`QueueRest`, matching the export's `decRest`). This one
 * is what is still WAITING, and it feeds the per-section "needs you" badge and
 * nothing that is labelled a queue total.
 *
 * The distinction used to be spent the other way, and that is what produced the
 * release blocker: `QueueRest` filtered on this set while `DecisionDock`
 * printed a count over the wider one, under the same three words, on the same
 * screen. Whichever set the phrase means, ONE surface must own it.
 */
/*
 * NOT EXPORTED, and that is the point. It was, and a second surface imported it
 * to headline a count under the same three words the wider set already owned.
 * Keeping it module-private makes the rule structural: `needsYouCountOf` below
 * is the only way out, so nothing can label this set a queue total again.
 */
const OPEN_STATES = new Set<Field["state"]>(["needs_review", "escalated"]);

/**
 * THE HEADINGS ARE THE DELIVERED DOCUMENT'S OWN WORDS, verbatim from the
 * export's report (`:2395-2441`) and its rail (`:1071-1077`): Title Case, and
 * the abstractor's vocabulary rather than a paraphrase of it. They read
 * `Vesting & owner`, `Mortgages & deeds of trust`, `Assessment & taxes` — three
 * headings a typist comparing this draft against the Word template would have
 * to translate, on a sheet whose own intro promises they "match the delivered
 * Word document exactly". The casing is invisible on screen (`Eyebrow` is
 * `uppercase`); the WORDS are not.
 */
export const SECTION_HEADING: Record<string, string> = {
  search: "Search Information",
  owner: "Vesting",
  deed: "Vesting Deed",
  mortgages: "Open Mortgages / Deeds of Trust",
  legal: "Legal Description",
  judgments: "Judgments & Liens",
  assessment: "Taxes & Assessments",
  notes: "Requirements / Notes",
};

/**
 * DELIVERED-DOCUMENT ORDER, DECLARED. This module's comment has claimed since
 * it was written that "section order follows the delivered document, not the
 * payload order" while `sectionsOf` returned `[...groups.entries()]` — Map
 * insertion order, i.e. exactly the payload order it disclaimed. The sheet
 * therefore rendered Legal Description ahead of Vesting Deed and Judgments
 * after Taxes, neither of which is the order the client receives.
 *
 * A key absent from the payload simply never appears (`sectionsOf` only emits
 * groups that have fields), and a key absent from THIS list is appended in
 * payload order rather than dropped — an unknown section is a fixture the
 * screen has not been taught, not a section to hide.
 *
 * CONTRACT GAP: the export's first and last sections, `Search Information` and
 * `Requirements / Notes`, have no field paths on the wire. They are named here
 * so the order is the document's whole order, not the part we happen to serve.
 */
const SECTION_ORDER: readonly string[] = [
  "search",
  "owner",
  "deed",
  "mortgages",
  "legal",
  "judgments",
  "assessment",
  "notes",
];

/**
 * THE ONE GROUPING FUNCTION. `CallBackSheet` (the draft report) and
 * `SectionRail` (the jump nav beside it) must walk the SAME sections in the
 * SAME order — a rail that offers "Judgments" when the sheet renders it under
 * a differently-derived key is a broken link wearing a working label. Both
 * import this instead of each re-deriving the split from `field.path`.
 */
export function sectionsOf(fields: readonly Field[]): [string, Field[]][] {
  const groups = new Map<string, Field[]>();
  for (const field of fields) {
    const section = field.path.split(".")[0] ?? "other";
    groups.set(section, [...(groups.get(section) ?? []), field]);
  }
  const known = SECTION_ORDER.filter((section) => groups.has(section));
  const unknown = [...groups.keys()].filter(
    (section) => !SECTION_ORDER.includes(section),
  );
  return [...known, ...unknown].map((section) => [section, groups.get(section) ?? []]);
}

/**
 * How many fields in this group still need a person — `needs_review`, or sent
 * up and not yet resolved (`escalated`). Used for the rail's per-section badge
 * so a reviewer can see WHERE the open decisions are before jumping, not just
 * that some exist. `auto_confirmed` and settled states are deliberately absent
 * from this count: nobody is waiting on those.
 */
export function needsYouCountOf(fields: readonly Field[]): number {
  return fields.filter((f) => OPEN_STATES.has(f.state)).length;
}

/** The anchor id a section's container renders, and the href a rail link points at. */
export function sectionAnchor(section: string): string {
  return `section-${section}`;
}

/**
 * THE PAGE THIS SECTION WAS READ FROM — the first cited page among its fields,
 * or `null` when not one of them carries a cite yet.
 *
 * READ STRAIGHT OFF `source_page`. It is never inferred from a section's
 * position in the package or from the order of the payload: the number a
 * reviewer needs is the one printed on the physical page, because that is what
 * they will turn to and what they will quote to the county.
 *
 * `null` IS NOT PAGE ONE. A section whose fields are all `pending` has nothing
 * to cite, and drawing `pg 1` there would invent a citation — which is the
 * exact artefact principle 6 exists to prevent, made worse by being plausible.
 * Both callers render nothing at all on `null` rather than a placeholder.
 *
 * FIRST, NOT LOWEST. A section's fields arrive in the order the server assembled
 * them, and the first one that cites anything is the page the section OPENS on.
 * `Math.min` would answer a different question — "the earliest page this section
 * touches" — which is not what "jump to Judgments" means when a judgment's
 * decree is recorded twenty pages before its satisfaction.
 */
export function sectionPageOf(fields: readonly Field[]): number | null {
  return fields.find((f) => f.source_page !== null)?.source_page ?? null;
}
