import { Link, type LinkComponentProps } from "@tanstack/react-router";

/**

 * THE DOOR THIS SCREEN LEADS TO NEXT — one component, because fourteen of the nineteen

 * features had no outbound link at all. Measured 2026-08-28 by walking every `<Link

 * to=>` and `<LinkButton href=>` in the tree: only `overview`,…

 */
export function RelatedDoor(props: {
  readonly to: LinkComponentProps<"a">["to"];
  readonly children: React.ReactNode;
}) {
  return (
    <p className="text-meta leading-body text-ink-secondary">
      <Link
        to={props.to}
        data-testid="related-door"
        className="tp-state font-semibold text-action underline underline-offset-4"
      >
        {props.children}
      </Link>
    </p>
  );
}
