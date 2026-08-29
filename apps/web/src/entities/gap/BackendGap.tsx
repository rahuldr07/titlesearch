import type { ReactNode } from "react";

/**
 * WHAT THE DESIGN DRAWS AND THE CONTRACT CANNOT SERVE — SAID PLAINLY.
 *
 * Three of the objects in design §Screens 5 and §6 have NO contract shape, and
 * `ANALYSIS-screens.md` §7 conversation 3 is the record of asking for them:
 * the Quarantine Gateway checklist, the Optical Profile card, and the dark
 * streaming terminal. Transcribing any of them would put a four-step state
 * machine, three thresholds, or probe output in the browser — hard rule 3 for
 * the first two, `entities.ts:17-19` for the third ("probes are never visible
 * in any client").
 *
 * So each renders as this: the object's name, what it would bind to if the
 * shape existed, and the blocking question. It is deliberately NOT a skeleton
 * and NOT a spinner. A skeleton says "this is loading and will arrive"; the
 * honest statement is "nothing is coming until a backend conversation
 * settles", and a reader who cannot tell those apart will wait for the wrong
 * one.
 *
 * It is also NOT an `Empty`: an empty pane is a pane with nothing IN it, and
 * this is a pane with nothing BEHIND it. Different facts, `entities/` is where
 * the taxonomy lives (see `components/ui/empty.tsx`), and this is a member of
 * it.
 *
 * A Card is deliberately not used — nested cards are forbidden (RECIPES
 * §Card), and every site that needs this already sits inside one.
 */
export function BackendGap(props: {
  /** The design's own name for the object, so a reader can find it in §Screens. */
  readonly object: string;
  /** Where the blocking question is recorded, e.g. "ANALYSIS-screens.md §7". */
  readonly conversation: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      data-testid="backend-gap"
      data-gap-object={props.object}
      className="flex flex-col gap-4 rounded-md border border-dashed border-line-strong bg-surface-sunken px-8 py-6"
    >
      <div className="flex flex-wrap items-baseline gap-4">
        <span className="text-label font-semibold leading-flat text-ink-faint">
          Waiting on the backend
        </span>
        <span className="font-sans text-meta font-semibold leading-close text-ink-primary">
          {props.object}
        </span>
      </div>
      <p className="font-sans text-meta leading-body text-ink-secondary">
        {props.children}
      </p>
      <span className="font-mono text-label leading-flat text-ink-faint">
        {props.conversation}
      </span>
    </section>
  );
}
