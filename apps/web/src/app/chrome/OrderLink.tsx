import { Link } from "@tanstack/react-router";
import { cx } from "../../components/ui";

/**
 * An order id, as a door — the one spelling of "link to this order".
 */
export function OrderLink(props: {
  readonly orderId: string;
  readonly className?: string | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <Link
      to="/orders/$orderId"
      params={{ orderId: props.orderId }}
      data-testid="order-link"
      className={cx(
        "tp-state rounded-sm underline-offset-4 hover:underline",
        props.className,
      )}
    >
      {props.children}
    </Link>
  );
}
