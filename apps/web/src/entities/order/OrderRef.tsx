import { cx } from "../../components/ui";

/**
 * An order reference, always mono. A component rather than a class string
 * because the ref appears on most screens, and one place has to decide how
 * it is drawn. `emphasis` is a size, not a semantic — the spotlight and a
 * table row are the same datum.
 */
export type OrderRefProps = {
  /**
   * Not named `ref`: React 19 passes `ref` as an ordinary prop to function
   * components, so the obvious name would typecheck and then be intercepted
   * — a ref string landing on a DOM node.
   */
  readonly orderRef: string;
  /** `spotlight` is the accent spend. At most once per screen. */
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
