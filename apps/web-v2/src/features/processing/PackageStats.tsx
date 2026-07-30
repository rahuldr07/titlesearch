import { Card } from "../../shared/ui/Card";
import { CensusTile } from "../../shared/ui/CensusTile";

/**
 * Pages in, pages read, and why the second number is so much smaller.
 *
 * The sentence beside the two numerals is the point of this strip. "11 of 38"
 * with no explanation reads as 27 pages skipped; with the classifier's reason
 * beside it, it reads as 27 pages that hold nothing the report needs. The
 * numbers are useless — actively misleading — without it, which is why they
 * share one bordered block rather than sitting as two loose stats, and why the
 * sentence arrives from the server rather than being written here.
 *
 * BOTH FIGURES ARE A CENSUS, NEVER A RATE (§4.5). They count what is sitting in
 * the package right now; nothing here is per hour, per person or against a
 * target, and `CensusTile` is the component that makes a request for one of
 * those read as the category error it is. `pages_relevant / total_pages` as a
 * percentage would be the first such figure, and this strip is where it would
 * land.
 *
 * The two numeral cells are the WIDER pair — the design gives them about three
 * tenths each and leaves the sentence the remainder. Quartering the numerals
 * and handing the sentence a half pushed the two numbers into the left corner
 * and set the sentence in a column so wide it stopped reading as a caption on
 * them and started reading as unrelated prose beside them. The tiles reach
 * three tenths by growing off a shared basis rather than by claiming it: at
 * this screen's measure that lands on the same split, and it degrades by
 * shrinking the sentence instead of crushing a numeral.
 *
 * `edge` on both tiles, never on the sentence — the divider belongs BETWEEN
 * cells, and the last cell in a row that already has an outer border would draw
 * a second rule against it.
 */
export function PackageStats({
  totalPages,
  pagesRelevant,
  classifierNote,
}: {
  totalPages: number;
  pagesRelevant: number;
  classifierNote: string;
}) {
  return (
    <Card className="flex">
      <CensusTile value={totalPages} caption="Pages in package" edge />
      <CensusTile value={pagesRelevant} caption="Read in full" tone="action" edge />

      <p className="flex basis-2/5 items-center px-8 py-6 text-sm leading-body text-ink-secondary">
        {classifierNote}
      </p>
    </Card>
  );
}
