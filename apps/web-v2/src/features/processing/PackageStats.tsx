import { Eyebrow } from "../../shared/ui/Eyebrow";

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
 * Mono numerals: these get compared against the package a person is holding.
 *
 * The two numeral cells are the WIDER pair — the design gives them about three
 * tenths each and leaves the sentence the remainder. Quartering the numerals
 * and handing the sentence a half pushed the two numbers into the left corner
 * and set the sentence in a column so wide it stopped reading as a caption on
 * them and started reading as unrelated prose beside them.
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
    <div className="flex overflow-hidden rounded-9 border border-line-strong bg-surface-panel">
      <div className="basis-3/10 border-r border-line-strong px-9 py-7">
        <p className="font-mono text-3xl leading-flat font-semibold">{totalPages}</p>
        <Eyebrow variant="stat" as="p" className="mt-2">
          Pages in package
        </Eyebrow>
      </div>

      <div className="basis-3/10 border-r border-line-strong px-9 py-7">
        <p className="font-mono text-3xl leading-flat font-semibold text-action">
          {pagesRelevant}
        </p>
        <Eyebrow variant="stat" as="p" className="mt-2">
          Read in full
        </Eyebrow>
      </div>

      <p className="flex basis-2/5 items-center px-9 py-7 text-sm leading-body text-ink-secondary">
        {classifierNote}
      </p>
    </div>
  );
}
