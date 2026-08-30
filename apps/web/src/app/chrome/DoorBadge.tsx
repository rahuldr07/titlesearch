import type { RailBadgesResponse } from "@titlepipe/contract";
import { RailBadge } from "./RailSignal";

/**
 * The served ornament for one rail door, if the reference app draws one there
 * (RULING-2026-08-29). Split from `RailSection.tsx` for the 150-line gate; the
 * seam is clean — this file knows which door wears which badge, the section
 * only knows every door may wear one.
 */
export function DoorBadge(props: {
  readonly path: string;
  readonly badges: RailBadgesResponse | undefined;
}) {
  if (props.badges === undefined) return null;
  if (props.path === "/orders-list") {
    return (
      <RailBadge
        path={props.path}
        tone="count"
        title="Orders in the shop, as the server counts them"
      >
        {props.badges.orders_total}
      </RailBadge>
    );
  }
  if (props.path === "/escalations" && props.badges.qc !== null) {
    return (
      <RailBadge
        path={props.path}
        tone="attend"
        title="Unresolved escalations are waiting"
      >
        {props.badges.qc}
      </RailBadge>
    );
  }
  if (props.path === "/templates") {
    return (
      <RailBadge path={props.path} tone="accent" title="The active template version">
        {props.badges.template_version}
      </RailBadge>
    );
  }
  return null;
}
