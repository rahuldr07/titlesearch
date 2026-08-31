import { Separator as SeparatorPrimitive } from "react-aria-components";

import { cx } from "./cx";

/**
 * A structural hairline, `line-subtle` — an interior division is quieter than
 * the boundary containing it. Deliberately no thickness prop: a 2px
 * separator is a border wanting to be a card, and the answer to that is a
 * card.
 */
function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cx(
        "block shrink-0 border-0 bg-line-subtle",
        "aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full",
        "aria-[orientation=vertical]:w-px aria-[orientation=vertical]:self-stretch",
        "[:is(hr)]:h-px [:is(hr)]:w-full",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
