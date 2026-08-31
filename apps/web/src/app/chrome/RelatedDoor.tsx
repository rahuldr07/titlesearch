import { Link, type LinkComponentProps } from "@tanstack/react-router";

/** The door this screen leads to next — one spelling of an outbound link. */
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
