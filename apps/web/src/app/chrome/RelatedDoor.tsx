import { Link, type LinkComponentProps } from "@tanstack/react-router";

/**
 * THE DOOR THIS SCREEN LEADS TO NEXT — one component, because fourteen of the
 * nineteen features had no outbound link at all.
 *
 * Measured 2026-08-28 by walking every `<Link to=>` and `<LinkButton href=>` in
 * the tree: only `overview`, `dashboard`, `ingest`, `account` and the rail
 * pointed anywhere. The rest were islands reachable only from the rail, which
 * makes the app a menu rather than a graph — a reader who has just ruled on a
 * seed has no way to the correction that follows from it, and a bench failure
 * naming a golden field cannot open it.
 *
 * ══ WHY A COMPONENT AND NOT FOURTEEN LOOSE ANCHORS ═════════════════════════
 *
 * So the join reads the same everywhere and is typed everywhere. `to` and
 * `params` are checked against `routeTree.tsx`, so a renamed route breaks the
 * build rather than the app. The alternative already exists in the tree — seven
 * `LinkButton href={...}` strings that nothing checks — and this is the shape
 * that does not add an eighth.
 *
 * ══ IT IS A SENTENCE, NOT A BUTTON ═════════════════════════════════════════
 *
 * A cross-reference is navigation of the "you probably want this next" kind,
 * not the screen's action. Rule 1 spends the accent once per screen on the
 * OPEN DECISION or the single primary action, and a related-door link is
 * neither — so it is `text-action` ink with an underline, never a filled
 * button. The arrow is the prototype's own idiom for this ("View all orders →",
 * "Open →") and stays a text glyph rather than an icon, per rule 7.
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
