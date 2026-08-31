import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./cx";

/**
 * The kit's one failure/status region. `message` is a string, not a
 * ReactNode: the server's sentence renders verbatim, and a call site cannot
 * compose a prefix into it invisibly. `title` is the screen's own name for
 * the region ("Refused"), never a restatement of the refusal.
 */
const region = cva(
  [
    // Input-rung radius: an alert stands inside a card or screen body, not at
    // the surface rung.
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

/** The closed glyph vocabulary; an alert may draw exactly these three. */
const GLYPH = { settled: "✓", attend: "◆", halt: "•" } as const;

export type AlertTone = keyof typeof GLYPH;

export type AlertProps = VariantProps<typeof region> & {
  /**
   * The server's sentence, rendered verbatim — never prefixed, never edited.
   * A string rather than a ReactNode so composing one is visible at the call
   * site.
   */
  readonly message: string;
  /** The screen's name for the region, e.g. "Refused". Not the refusal itself. */
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
      // A halt interrupts (assertive `alert`); the other two wait (polite
      // `status`), so a settled confirmation never barges in mid-sentence.
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
        {/* text-ink-primary, not the family ink: the signal is the glyph,
            weight and tint, and 13px of coloured prose is hard to read. */}
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
