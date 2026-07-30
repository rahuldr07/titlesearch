import { Card } from "../../shared/ui/Card";

/**
 * The gate's own verdict, in the two states it has.
 *
 * BOTH BANNERS TAKE THEIR GROUND FROM `Card tone`, AND THEIR LEFT EDGE STAYS.
 * `--stroke-severity` is the 4px left edge that means "this is a problem"; it is
 * a different claim from `Card accent`, the 2px top stripe that means "this is
 * the live block", and a verdict about a halted run is the first one. Spelling
 * the ground and hairline by hand is what let the same meaning drift to three
 * strengths across the app, so the pair comes from the one axis that cannot be
 * mismatched.
 *
 * THE OPEN BANNER'S JOB IS TO REMOVE THE PANIC. A halted run reads as damage
 * until you know where it stopped, so the banner says it plainly: the stop is
 * BEFORE extraction, nothing has been extracted, re-running costs nothing. Left
 * unsaid, people close gaps in a hurry to protect work that was never at risk.
 *
 * The three-step strip is the same sentence as a picture — passed, halted,
 * held — so the position of the stop is readable without parsing the prose.
 * The dot pulses because it is the one thing on the screen that is stopped.
 */
export function GateOpenBanner() {
  return (
    <Card
      tone="halt"
      className="border-l-(length:--stroke-severity) border-l-state-halt p-8"
    >
      <div className="mb-4 flex items-center gap-5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 animate-tp-pulse items-center justify-center rounded-full bg-state-halt text-md font-bold text-ink-on-action"
        >
          !
        </span>
        <h2 className="text-lg font-semibold text-state-halt-ink">
          Package incomplete — the run is paused
        </h2>
      </div>

      <p className="mb-6 text-base leading-open text-state-halt-ink">
        The pipeline halted right after segmentation, before extraction. Nothing
        has been extracted yet, so re-running costs nothing. Close every gap
        below to resume.
      </p>

      <div className="flex flex-wrap items-center gap-4 font-mono text-tiny">
        <span className="rounded-4 border border-state-settled-border bg-state-settled-surface px-4 py-2 text-state-settled-ink">
          ✓ classify &amp; segment
        </span>
        <span aria-hidden className="text-ink-muted">→</span>
        <span className="rounded-4 bg-state-halt px-4 py-2 text-ink-on-action">
          ✕ completeness gate · halted
        </span>
        <span aria-hidden className="text-ink-muted">→</span>
        <span className="rounded-4 border border-line-strong bg-surface-app px-4 py-2 text-ink-muted">
          extract fields · held
        </span>
      </div>
    </Card>
  );
}

/**
 * CONTRACT GAP: the completeness payload carries no page count, so the closed
 * banner no longer names the size of the package extraction will run on.
 */
export function GateClosedBanner() {
  return (
    <Card
      tone="settled"
      className="flex items-center gap-6 border-l-(length:--stroke-severity) border-l-state-settled p-8"
    >
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-state-settled text-lg text-ink-on-action"
      >
        ✓
      </span>
      <p className="text-md leading-body text-state-settled-ink">
        Package complete — every gap is closed. Resume to run extraction on the
        full package.
      </p>
    </Card>
  );
}
