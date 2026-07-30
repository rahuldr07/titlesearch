import { canAccess, type Role } from "@titlepipe/contract";
import { railGlyphs } from "./glyphs";

/**
 * The doors, and the chord key that opens each.
 *
 * WHICH DOORS A ROLE HOLDS IS NOT DECIDED HERE. `canAccess` comes from
 * `packages/contract/src/authz.ts` — the same table the mock server gates
 * mutations with, so the UI's affordances and the server's refusals cannot
 * drift apart. That is the whole point of `authz.spec`: "the same permission
 * data gates the UI's affordances AND the mock server's mutations… they are
 * one table."
 *
 * A door outside a role's world is ABSENT, never dimmed (`account.spec` #4,
 * `home.spec` #2, `roles.spec` ×4). Dimming tells someone a thing exists and
 * is being withheld; absence tells them it is not part of their job.
 *
 * `label` is what the `?` key map prints, and it is load-bearing: `roles.spec`
 * asserts a typist's map does NOT contain "escalation inbox" or "readout".
 *
 * `group` decides which of the rail's sections draws a door (Task 12):
 * `work` / `admin` / `reference` render as a plain labelled list; `this-order`
 * doors are drawn by `LifecycleRail` instead (the numbered pipeline), never
 * this list, so `group` is metadata for the RENDERER to route on, not a
 * second source of the door set. `account` renders in NEITHER — the design
 * does not draw Profile as a rail door (it lives in the account menu), and no
 * test requires it in the rail, so it stays in `DOORS`/`doorsFor` for the
 * chord and the `?` map only.
 *
 * THE SQUARE'S LETTER IS DERIVED, NOT STORED, and it is resolved across the
 * whole drawn set so no two rows can show the same mark — `glyphs.ts` holds the
 * tie-break and why the export's P/P collision was not simply copied. An `icon`
 * field would be a second copy of the label's first letter, free to drift from
 * it; a derivation cannot. The CHORD lives in `key` and is surfaced where a
 * chord is actually learned — the row's `title` (`doorTitle`) and the `?` map,
 * which already prints `g <key>` beside the label. `Door.key` is therefore
 * still the single source of the chord, and nothing aliases it.
 */
type DoorGroup = "work" | "this-order" | "admin" | "reference" | "account";

export interface Door {
  path: string;
  /** Chord second key: `g` then this. */
  key: string;
  label: string;
  group: DoorGroup;
}

/** Screens the authz table restricts. Everything else is open by default. */
const RESTRICTED: readonly string[] = ["/queue", "/orders", "/escalations", "/ingest"];

/** Not exported: consumers go through `doorsFor` so the role filter is never bypassed. */
const DOORS: readonly Door[] = [
  { path: "/queue", key: "q", label: "queue", group: "work" },
  { path: "/overview", key: "o", label: "overview", group: "work" },
  { path: "/ingest", key: "u", label: "upload", group: "this-order" },
  { path: "/questions", key: "n", label: "questions", group: "this-order" },
  { path: "/processing", key: "p", label: "processing", group: "this-order" },
  { path: "/completeness", key: "c", label: "completeness", group: "this-order" },
  { path: "/delivered", key: "d", label: "delivered", group: "this-order" },
  { path: "/escalations", key: "e", label: "escalation inbox", group: "work" },
  { path: "/rulebook", key: "b", label: "rulebook", group: "admin" },
  { path: "/products", key: "t", label: "products & sign-off", group: "admin" },
  { path: "/clients", key: "l", label: "clients", group: "admin" },
  { path: "/people", key: "m", label: "people", group: "admin" },
  { path: "/audit", key: "a", label: "audit", group: "admin" },
  { path: "/profile", key: "f", label: "profile", group: "account" },
  { path: "/gallery", key: "g", label: "states", group: "reference" },
];

/**
 * The doors this role actually holds, in catalogue order.
 *
 * A path with NO row in the authz table is OPEN — the table lists the screens
 * whose access is restricted, not every screen that exists. Treating a missing
 * row as a refusal would hide the whole order flow from everyone, which is the
 * opposite of what the table says: it is a list of exceptions, and the default
 * is reachable. Restricted paths still go through `canAccess`, the same
 * function the server gates with.
 */
function isRestricted(path: string): boolean {
  return RESTRICTED.some((p) => path === p || path.startsWith(`${p}/`));
}

export function doorsFor(role: Role): Door[] {
  return DOORS.filter((door) => canOpen(role, door.path));
}

/**
 * May this role open this path? The SAME gate `doorsFor` applies, exposed for
 * routes that are not doors — the lifecycle rail's Review stage is order-scoped
 * (`/orders/<id>/review`) and appears in no catalogue. `AppChrome` used to admit
 * it with `to.startsWith("/orders/")`, which short-circuits the door check and
 * draws the row for EVERY role, including one `canAccess` refuses. An
 * affordance the server would refuse is the drift this file exists to prevent.
 */
export function canOpen(role: Role, path: string): boolean {
  return !isRestricted(path) || canAccess(role, path);
}

/** The door a chord's second key opens, or null if the role does not hold it. */
export function doorForKey(role: Role, key: string): Door | null {
  return doorsFor(role).find((door) => door.key === key) ?? null;
}

/**
 * Groups the rail draws as a LETTERED row, stated as the exclusion rather than
 * the inclusion: `this-order` is drawn numbered by `LifecycleRail` and
 * `account` is not drawn at all. A group added later therefore joins the
 * lettered set — and its uniqueness resolution — by default, instead of
 * silently opting out of it and reintroducing a duplicate square.
 */
const LETTERLESS: ReadonlySet<DoorGroup> = new Set<DoorGroup>(["this-order", "account"]);

export function isRailDoor(door: Door): boolean {
  return !LETTERLESS.has(door.group);
}

/**
 * Resolved ONCE over the whole catalogue, never per role: a door must not
 * change letter because somebody switched roles, and an assignment that is
 * collision-free over the catalogue is collision-free in every subset of it —
 * so every role's rail is distinct without resolving it once per role.
 */
const RAIL_GLYPHS = railGlyphs(DOORS.filter(isRailDoor));

/**
 * The letter the rail's square draws — unique among the doors the rail draws.
 * A letterless door (`this-order`, `account`) has no square; if something asks
 * anyway it gets the plain initial, which is what the export would have drawn.
 */
export function doorGlyph(door: Door): string {
  return RAIL_GLYPHS.get(door.path) ?? door.label.charAt(0).toUpperCase();
}

/**
 * The row's hover/AT text: what the door is, and the chord that opens it.
 * A chord is learned where it is printed — here and in the `?` map — never
 * from a one-letter square that has to double as an identifier.
 */
export function doorTitle(door: Door): string {
  return `${door.label} · g ${door.key}`;
}
