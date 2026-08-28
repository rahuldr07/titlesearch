import { Link, type LinkComponentProps } from "@tanstack/react-router";
import { buttonVariants, cx } from "../../components/ui";

/**
 * NAVIGATION THAT LOOKS LIKE A BUTTON AND IS CHECKED AGAINST THE ROUTE TREE.
 *
 * `LinkButton` (`components/ui/button.tsx`) takes react-aria's `href`, which is
 * a plain `string`. Seven internal destinations were spelled that way —
 * `/orders/${order.id}/review`, `/ingest`, `/orders/${props.orderId}` — and not
 * one of them was checked by anything. A typo in any produces a dead affordance
 * that renders INVARIANT 57's not-found state, and tsc, eslint and check-rules
 * are all silent about it because a wrong string is still a string.
 *
 * `Link` from TanStack Router IS checked: `to` is a union of the literal paths
 * in `routeTree.tsx`, and `params` is inferred per route, so a misspelt path or
 * a missing `$orderId` is a compile error. This component is that `Link`
 * wearing `buttonVariants`, so a button-shaped affordance no longer costs the
 * guarantee.
 *
 * ══ WHY THIS IS IN `app/` AND NOT IN THE KIT ═══════════════════════════════
 *
 * Because `components/ui` is a design system and the route tree is the app.
 * A typed route button inside the kit would make every kit file depend on
 * `routeTree.tsx` — the kit could not be lifted into another app, its stories
 * would need a router, and the dependency would point the wrong way. `app/` is
 * the layer that already knows both, which is the same argument `useRead.ts`
 * makes for living here.
 *
 * `LinkButton` STAYS and is not deprecated. It is the right component for an
 * `href` that is not a route — an external URL, a `mailto:`, a download — and
 * for the kit's own stories, which have no router. The rule is simply: an
 * internal destination uses this; anything else uses `LinkButton`.
 *
 * ══ ON NOT REBUILDING THE CHROME ═══════════════════════════════════════════
 *
 * `buttonVariants` is exported from the barrel precisely so a second element
 * can wear the button's geometry without a second copy of it (`index.ts:29`
 * notes the trade). Height, radius, the four variants and the focus ring all
 * come from there, so this cannot drift from `Button` — rule 11 applied to a
 * class string.
 *
 * No `disabledBecause`. A disabled LINK is a contradiction: rule 12 says a
 * blocked affordance renders disabled WITH its reason, and the honest render of
 * a door you may not open is the door being ABSENT (INVARIANT 42/43), which is
 * a decision for the caller and not something to express here.
 */
export type RouteButtonProps = LinkComponentProps<"a"> & {
  readonly variant?: "primary" | "secondary" | "ghost" | "halt" | undefined;
  readonly size?: "sm" | "md" | "lg" | undefined;
};

export function RouteButton({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: RouteButtonProps) {
  return (
    <Link
      data-slot="button"
      data-variant={variant}
      data-size={size}
      {...props}
      className={cx(buttonVariants({ variant, size }), className)}
    />
  );
}
