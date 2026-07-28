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
 */
export interface Door {
  path: string;
  /** Chord second key: `g` then this. */
  key: string;
  label: string;
}

/** Screens the authz table restricts. Everything else is open by default. */
const RESTRICTED: readonly string[] = ["/queue", "/orders", "/escalations", "/ingest"];

/** Not exported: consumers go through `doorsFor` so the role filter is never bypassed. */
const DOORS: readonly Door[] = [
  { path: "/queue", key: "q", label: "queue" },
  { path: "/overview", key: "o", label: "overview" },
  { path: "/ingest", key: "u", label: "upload" },
  { path: "/questions", key: "n", label: "questions" },
  { path: "/processing", key: "p", label: "processing" },
  { path: "/completeness", key: "c", label: "completeness" },
  { path: "/delivered", key: "d", label: "delivered" },
  { path: "/escalations", key: "e", label: "escalation inbox" },
  { path: "/rulebook", key: "b", label: "rulebook" },
  { path: "/products", key: "t", label: "products & sign-off" },
  { path: "/clients", key: "l", label: "clients" },
  { path: "/people", key: "m", label: "people" },
  { path: "/audit", key: "a", label: "audit" },
  { path: "/profile", key: "f", label: "profile" },
  { path: "/gallery", key: "g", label: "states" },
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
