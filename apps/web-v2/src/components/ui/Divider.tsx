import { Separator, type SeparatorProps } from "react-aria-components";
import { cx } from "./cx";

/**
 * An interior division, drawn as a hairline.
 *
 * Depth (`shadow-card`) separates a card from the canvas; a hairline divides
 * the INSIDE of one. Using a shadow for an interior division produces the
 * stacked-cards look the 2026-08 register deliberately dropped, and using a
 * hairline against the canvas produces a rule nobody can see.
 *
 * `react-aria`'s Separator rather than a bare `<hr>` because orientation has to
 * reach assistive technology, and a vertical `<hr>` reports as horizontal.
 */
export type DividerProps = Omit<SeparatorProps, "className">;

export function Divider({ orientation = "horizontal", ...props }: DividerProps) {
  return (
    <Separator
      {...props}
      orientation={orientation}
      className={cx(
        "border-0 bg-line-strong",
        orientation === "vertical" ? "h-full w-px" : "h-px w-full",
      )}
    />
  );
}
