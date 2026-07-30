import { canAccess, type Role } from "@titlepipe/contract";

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
 * chord and the `?` map only. `icon` is the letter-icon square shown on every
 * rendered door, collapsed AND expanded — always the chord key, upper-cased,
 * so it can never drift from the key that actually opens the door.
 */
type DoorGroup = "work" | "this-order" | "admin" | "reference" | "account";

export interface Door {
  path: string;
  /** Chord second key: `g` then this. */
  key: string;
  label: string;
  group: DoorGroup;
  /** Single-letter icon for the rail's icon-square. */
  icon: string;
}

/** Screens the authz table restricts. Everything else is open by default. */
const RESTRICTED: readonly string[] = ["/queue", "/orders", "/escalations", "/ingest"];

/** Not exported: consumers go through `doorsFor` so the role filter is never bypassed. */
const DOORS: readonly Door[] = [
  { path: "/queue", key: "q", label: "queue", group: "work", icon: "Q" },
  { path: "/overview", key: "o", label: "overview", group: "work", icon: "O" },
  { path: "/ingest", key: "u", label: "upload", group: "this-order", icon: "U" },
  { path: "/questions", key: "n", label: "questions", group: "this-order", icon: "N" },
  { path: "/processing", key: "p", label: "processing", group: "this-order", icon: "P" },
  { path: "/completeness", key: "c", label: "completeness", group: "this-order", icon: "C" },
  { path: "/delivered", key: "d", label: "delivered", group: "this-order", icon: "D" },
  { path: "/escalations", key: "e", label: "escalation inbox", group: "work", icon: "E" },
  { path: "/rulebook", key: "b", label: "rulebook", group: "admin", icon: "B" },
  { path: "/products", key: "t", label: "products & sign-off", group: "admin", icon: "T" },
  { path: "/clients", key: "l", label: "clients", group: "admin", icon: "L" },
  { path: "/people", key: "m", label: "people", group: "admin", icon: "M" },
  { path: "/audit", key: "a", label: "audit", group: "admin", icon: "A" },
  { path: "/profile", key: "f", label: "profile", group: "account", icon: "F" },
  { path: "/gallery", key: "g", label: "states", group: "reference", icon: "G" },
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
  return DOORS.filter((door) => !isRestricted(door.path) || canAccess(role, door.path));
}

/** The door a chord's second key opens, or null if the role does not hold it. */
export function doorForKey(role: Role, key: string): Door | null {
  return doorsFor(role).find((door) => door.key === key) ?? null;
}
