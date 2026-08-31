import { Link, type LinkComponentProps } from "@tanstack/react-router";
import { buttonVariants, cx } from "../../components/ui";

/**
 * Navigation that looks like a button and is checked against the route
 * tree — unlike `LinkButton`, whose `href` is a plain string.
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
