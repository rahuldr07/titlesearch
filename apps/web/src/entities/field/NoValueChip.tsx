import type { ReactNode } from "react";
import { cx } from "../../components/ui";
import { NO_VALUE, type NoValueRender } from "./noValueStates";

/**
 * One typed absence, drawn — a mark plus weight, never a blank or a coloured
 * capsule. Extracted rather than inlined in FieldValueView because
 * ReadingPair needs the same chip, and two hand-copied versions is how the
 * five renders drift back into one grey dash. `data-field-render` and
 * `data-surfaced-for-review` are the machine-readable half the tests assert
 * against.
 */
export type NoValueChipProps = {
  readonly render: NoValueRender;
  /** Overrides the taxonomy sentence. Only for a non-field absence. */
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
