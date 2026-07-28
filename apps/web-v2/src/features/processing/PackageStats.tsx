import { Eyebrow } from "../../shared/ui/Eyebrow";
import { CLASSIFIER_NOTE, PACKAGE_PAGES, PAGES_READ_IN_FULL } from "./pipelineStages";

/**
 * Pages in, pages read, and why the second number is so much smaller.
 *
 * The sentence beside the two numerals is the point of this strip. "11 of 64"
 * with no explanation reads as 53 pages skipped; with the classifier's reason
 * beside it, it reads as 53 pages that hold nothing the report needs. The
 * numbers are useless — actively misleading — without it, which is why they
 * share one bordered block rather than sitting as two loose stats.
 *
 * Mono numerals: these get compared against the package a person is holding.
 */
export function PackageStats() {
  return (
    <div className="flex overflow-hidden rounded-9 border border-line-strong bg-surface-panel">
      <div className="basis-1/4 border-r border-line-strong px-9 py-7">
        <p className="font-mono text-3xl leading-flat font-semibold">{PACKAGE_PAGES}</p>
        <Eyebrow variant="stat" as="p" className="mt-2">
          Pages in package
        </Eyebrow>
      </div>

      <div className="basis-1/4 border-r border-line-strong px-9 py-7">
        <p className="font-mono text-3xl leading-flat font-semibold text-action">
          {PAGES_READ_IN_FULL}
        </p>
        <Eyebrow variant="stat" as="p" className="mt-2">
          Read in full
        </Eyebrow>
      </div>

      <p className="flex basis-1/2 items-center px-9 py-7 text-sm leading-body text-ink-secondary">
        {CLASSIFIER_NOTE}
      </p>
    </div>
  );
}
