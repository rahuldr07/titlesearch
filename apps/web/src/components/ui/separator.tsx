import { Separator as SeparatorPrimitive } from "react-aria-components";

import { cx } from "./cx";

/**
 * ADAPTED FROM THE REGISTRY `separator`. Two changes and one refusal.
 *
 * `bg-border` becomes `bg-line-subtle` — the token file splits STRUCTURAL rules
 * (`line-*`) from CONTROL CHROME (`control-border`), and a divider is
 * structural. `subtle` rather than `strong`: the strong rule is what draws a
 * card's edge; an interior division is quieter than the boundary containing it.
 *
 * The refusal: there is no `decorative` escape and no thickness prop. Design
 * elevation says depth separates a surface from the canvas and HAIRLINES divide
 * an interior — never both, never thicker. A 2px separator is a border wanting
 * to be a card, and the answer to that is a card.
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
