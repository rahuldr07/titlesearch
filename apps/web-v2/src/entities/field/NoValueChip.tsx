import type { ReactNode } from "react";
import { cx } from "../../components/ui/cx";
import { NO_VALUE, type NoValueRender } from "./noValueStates";

/**
 * ONE TYPED ABSENCE, DRAWN.
 *
 * Rule 14: absence is typed, never a blank. Rule 6: a mark plus weight, not a
 * coloured capsule — an NA row is an ordinary row, not a "moment of record".
 *
 * Extracted rather than inlined in `FieldValueView` because `ReadingPair` needs
 * the same chip for an engine that returned nothing, and two hand-copied
 * versions is exactly how the five renders drift back into one grey dash.
 *
 * `data-field-render` and `data-surfaced-for-review` are the machine-readable
 * half: `entities/field/noValue.test.ts` asserts all five differ in both text
 * AND attribute, so a collapse fails a test rather than a code review.
 */
export type NoValueChipProps = {
  readonly render: NoValueRender;
  /** Overrides the taxonomy sentence. Only for a NON-field absence. */
  readonly sentence?: string | undefined;
  readonly className?: string | undefined;
  readonly children?: ReactNode;
};

export function NoValueChip({ render, sentence, className, children }: NoValueChipProps) {
  const descriptor = NO_VALUE[render];
  return (
    <span
      data-field-render={render}
      data-surfaced-for-review={descriptor.surfacedForReview}
      className={cx("flex flex-col items-start gap-1", className)}
    >
      <span
        className={cx(
          "inline-flex items-center gap-3 rounded-sm border px-4 py-1",
          "font-sans text-meta leading-close",
          descriptor.chrome,
        )}
      >
        <span aria-hidden className="font-mono text-label leading-flat">
          {descriptor.mark}
        </span>
        {sentence ?? descriptor.sentence}
      </span>
      {children}
    </span>
  );
}
