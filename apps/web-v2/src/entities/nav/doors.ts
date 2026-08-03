import { canAccess, type Role } from "@titlepipe/contract";
import { DOORS, type Door, type DoorGroup } from "./doorCatalogue";

export type { Door } from "./doorCatalogue";

/**
 * WHO MAY OPEN WHAT, and how a door presents itself. The catalogue it reads is
 * `doorCatalogue.ts`; this file is the only thing that touches `DOORS`.
 *
 * WHICH DOORS A ROLE HOLDS IS NOT DECIDED HERE EITHER. `canAccess` comes from
 * `packages/contract/src/authz.ts` — the same table the mock server gates
 * mutations with, so the UI's affordances and the server's refusals cannot drift
 * apart. That is the whole point of `authz.spec`: "the same permission data
 * gates the UI's affordances AND the mock server's mutations… they are one
 * table."
 *
 * A door outside a role's world is ABSENT, never dimmed (`account.spec` #4,
 * `home.spec` #2, `roles.spec` ×4). Dimming tells someone a thing exists and is
 * being withheld; absence tells them it is not part of their job.
 */

/** Screens the authz table restricts. Everything else is open by default. */
const RESTRICTED: readonly string[] = ["/queue", "/orders", "/escalations", "/ingest"];

/**
 * A path with NO row in the authz table is OPEN — the table lists the screens
 * whose access is restricted, not every screen that exists. Treating a missing
 * row as a refusal would hide the whole order flow from everyone, which is the
 * opposite of what the table says: it is a list of exceptions, and the default
 * is reachable.
 */
function isRestricted(path: string): boolean {
  return RESTRICTED.some((p) => path === p || path.startsWith(`${p}/`));
}

/** The doors this role actually holds, in catalogue order. */
export function doorsFor(role: Role): Door[] {
  return DOORS.filter((door) => canOpen(role, door.path));
}

/**
 * May this role open this path? The SAME gate `doorsFor` applies, exposed for
 * routes that are not doors — the lifecycle rail's Review stage is order-scoped
 * (`/orders/<id>/review`) and appears in no catalogue. `AppChrome` used to admit
 * it with `to.startsWith("/orders/")`, which short-circuits the door check and
 * draws the row for EVERY role, including one `canAccess` refuses. An affordance
 * the server would refuse is the drift this file exists to prevent.
 */
export function canOpen(role: Role, path: string): boolean {
  return !isRestricted(path) || canAccess(role, path);
}

/** The door a chord's second key opens, or null if the role does not hold it. */
export function doorForKey(role: Role, key: string): Door | null {
  return doorsFor(role).find((door) => door.key === key) ?? null;
}

/**
 * Groups the rail draws as an ICONED row, stated as the exclusion rather than
 * the inclusion: `this-order` is drawn numbered by `LifecycleRail` and `account`
 * is not drawn at all. A group added later therefore joins the iconed set — and
 * its uniqueness gate — by default, instead of silently opting out of it and
 * reintroducing a duplicate mark.
 */
const MARKLESS: ReadonlySet<DoorGroup> = new Set<DoorGroup>(["this-order", "account"]);

export function isRailDoor(door: Door): boolean {
  return !MARKLESS.has(door.group);
}

/**
 * The mark the rail draws beside a door — unique among the doors the rail draws
 * (`doors.test.ts`).
 *
 * A markless door (`this-order`, `account`) falls back to its label's initial.
 * That branch is not dead defensiveness: it is what any caller outside the rail
 * gets, and it means a door added to a drawn group without an icon degrades to a
 * legible letter in the ONE render before the test that requires an icon fails.
 */
export function doorGlyph(door: Door): string {
  return door.icon ?? door.label.charAt(0).toUpperCase();
}

/**
 * The row's hover/AT text: what the door is, and the chord that opens it. A
 * chord is learned where it is printed — here and in the `?` map — never from a
 * mark that has to double as an identifier.
 */
export function doorTitle(door: Door): string {
  return `${door.label} · g ${door.key}`;
}
