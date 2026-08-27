import { cx } from "../../components/ui/cx";

/**
 * AN ORDER REFERENCE. Rule 3's first named example: "Mono (--font-data) is for
 * data only: order refs, money, citations, hashes, timestamps, kbd."
 *
 * It exists as a component rather than as a class string because the ref appears
 * on nine of the twelve screens — overview spotlight, orders table, order bar,
 * workstation, certificate, delivery — and rule 11 ("numbers reconcile across
 * screens — one variable, never two literals") is only true if there is one
 * place that decides how a ref is drawn.
 *
 * `emphasis` is a SIZE, not a semantic. The spotlight draws the ref at 28px in
 * the accent (design §Screens 2); a table row draws it at 11px in grey. Both are
 * the same datum, so both are this component.
 */
export type OrderRefProps = {
  /**
   * NOT named `ref`. React 19 passes `ref` as an ordinary prop to function
   * components, so the obvious name would typecheck and then be intercepted by
   * anything wrapping this in a `forwardRef` — a ref string landing on a DOM
   * node. The datum is spelled out instead.
   */
  readonly orderRef: string;
  /** `spotlight` is the accent spend of rule 1. At most once per screen. */
  readonly emphasis?: "row" | "subject" | "spotlight" | undefined;
  readonly className?: string | undefined;
};

const EMPHASIS = {
  row: "text-label text-ink-muted",
  subject: "text-body text-ink-primary",
  spotlight: "text-title text-action font-semibold",
} as const;

export function OrderRef({ orderRef, emphasis = "row", className }: OrderRefProps) {
  return (
    <span
      data-order-ref={orderRef}
      className={cx(
        "font-mono leading-flat tabular-nums whitespace-nowrap",
        EMPHASIS[emphasis],
        className,
      )}
    >
      {orderRef}
    </span>
  );
}
