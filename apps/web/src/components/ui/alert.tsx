import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./cx";

/**
 * ADAPTED FROM THE REGISTRY `alert`, AND IT REPLACES EIGHT HAND-ROLLED
 * FAILURE RENDERS ACROSS `src/features/`.
 *
 * Before this existed, a refusal was a `<p role="alert" className="text-meta
 * leading-body text-state-halt">` written out again in `QueueStates`,
 * `PassReason`, `CredentialsForm`, `OverviewScreen`, `IngestScreen`,
 * `RulebookBanner`, `RefusedCard` and `RecentOrdersRefusal` — eight copies, four
 * of which had drifted into a different border/fill combination. Rule 11 is
 * about numbers and the same argument holds for chrome: one variable, never
 * eight literals.
 *
 * ══ THE MESSAGE IS THE SERVER'S, VERBATIM, AND THIS COMPONENT CANNOT EDIT IT ═
 *
 * `INVARIANTS:58-59` and `shared/notify.ts` carry the same rule from the toast
 * side: a refused mutation surfaces the SERVER's message unedited; the client
 * never authors the wording. So `message` is a `string`, not a `ReactNode`:
 *
 *   - A ReactNode invites `<>Error: {message}</>` at the call site, which is
 *     the prefix the rule forbids, written where no reviewer of THIS file would
 *     ever see it. A string cannot be composed into without the composition
 *     being visible in the screen's diff.
 *   - Nothing here prefixes, suffixes, capitalises, appends a period, or wraps
 *     the sentence in quotes. `{message}` and nothing else. If the server's
 *     sentence reads badly, the improvement belongs in the server.
 *
 * `title` is separate and is the SCREEN's own word for what happened
 * ("Refused", "Queue unavailable") — legitimate, because it names the region
 * rather than restating the refusal. It is optional; a bare message is a
 * complete alert.
 *
 * ══ THE TONES ARE THE TOKEN FILE'S THREE STATE FAMILIES ═════════════════════
 *
 * The registry shipped `default` and `destructive`. Neither is a thing this
 * palette has. `tokens.css` ships THREE families and states what each means:
 * settled = done, no action · attend = look at this · halt = stopped,
 * actionable. `destructive` maps onto `halt` and `default` maps onto nothing —
 * an alert with no state is a paragraph, and this kit already has one.
 *
 * ══ RULE 6: A MARK PLUS WEIGHT, CAPSULE LAST ════════════════════════════════
 *
 * The signal is the glyph (✓ ◆ •) and the weight of the title, drawn in the
 * family's ink. The tinted surface is the LAST carrier and it is deliberately
 * pale — `--color-state-*-surface` is the tint the token file reserves for
 * moments of record, and a whole-region alert IS one. It is never a filled red
 * box: that would put a second solid fill on a screen whose only fill is the
 * accent (rule 1). Colour is never alone — glyph, weight and words all differ,
 * so this survives greyscale and a red-green deficiency.
 */
const region = cva(
  [
    // Radius 10 — an alert stands INSIDE a card or a screen body, so it takes
    // the input rung rather than the 14px surface rung (rule 5).
    "grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 rounded-md border px-8 py-6",
    "text-left font-sans",
  ],
  {
    variants: {
      tone: {
        settled: "border-state-settled-border bg-state-settled-surface text-state-settled",
        attend: "border-state-attend-border bg-state-attend-surface text-state-attend",
        halt: "border-state-halt-border bg-state-halt-surface text-state-halt",
      },
    },
    defaultVariants: { tone: "halt" },
  },
);

/** Rule 7's closed glyph vocabulary, and an alert may draw exactly three of it. */
const GLYPH = { settled: "✓", attend: "◆", halt: "•" } as const;

export type AlertTone = keyof typeof GLYPH;

export type AlertProps = VariantProps<typeof region> & {
  /**
   * THE SERVER'S SENTENCE. Rendered verbatim — never prefixed, never edited.
   * A `string` rather than a ReactNode so composing one is visible at the call
   * site (`INVARIANTS:58-59`).
   */
  readonly message: string;
  /** The SCREEN's name for the region, e.g. "Refused". Not the refusal itself. */
  readonly title?: string | undefined;
  /** The way out — one button, at most. Optional: some refusals offer none. */
  readonly action?: ReactNode | undefined;
  readonly className?: string | undefined;
};

export function Alert({ tone = "halt", message, title, action, className }: AlertProps) {
  const mark = tone ?? "halt";
  return (
    <div
      data-slot="alert"
      data-tone={mark}
      /*
       * `alert` is an ASSERTIVE live region and it interrupts. Correct for a
       * halt — the reader's next keystroke is about to be wrong. `status` is
       * polite and is right for the other two: a settled confirmation that
       * barges in mid-sentence is a worse experience than one that waits.
       */
      role={mark === "halt" ? "alert" : "status"}
      className={cx(region({ tone }), className)}
    >
      <span aria-hidden data-slot="alert-mark" className="font-mono text-meta leading-body">
        {GLYPH[mark]}
      </span>
      <div className="flex min-w-0 flex-col gap-3">
        {title !== undefined && (
          <p data-slot="alert-title" className="text-meta leading-close font-semibold">
            {title}
          </p>
        )}
        {/*
          The server's words. `text-ink-primary` rather than the family ink:
          the SIGNAL is the glyph, the weight and the tint, and 13px of coloured
          prose is a paragraph nobody can read comfortably. The family ink is
          spent on the mark and the title, where rule 6 puts it.
        */}
        <p
          data-slot="alert-message"
          className="text-meta leading-body font-normal text-ink-primary"
        >
          {message}
        </p>
        {action !== undefined && (
          <div data-slot="alert-action" className="pt-3">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
