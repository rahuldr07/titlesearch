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

/** Not exported: consumers go through `doorsFor` so the role filter is never bypassed. */
const DOORS: readonly Door[] = [
  { path: "/", key: "h", label: "home" },
  { path: "/queue", key: "q", label: "queue" },
  { path: "/escalations", key: "e", label: "escalation inbox" },
  { path: "/dashboard", key: "d", label: "readout" },
  { path: "/complaints", key: "c", label: "complaints" },
  { path: "/delivery", key: "v", label: "delivery" },
  { path: "/blind-status", key: "s", label: "blind fifty status" },
  { path: "/bench", key: "b", label: "extraction bench" },
  { path: "/leaderboard", key: "l", label: "engine leaderboard" },
  { path: "/golden", key: "n", label: "golden set" },
  { path: "/reconciliation", key: "r", label: "reconciliation" },
  { path: "/ingest", key: "i", label: "ingest" },
  { path: "/blind", key: "t", label: "capture seat" },
  { path: "/account", key: "a", label: "account" },
];

/** The doors this role actually holds, in catalogue order. */
export function doorsFor(role: Role): Door[] {
  return DOORS.filter((door) => canAccess(role, door.path));
}

/** The door a chord's second key opens, or null if the role does not hold it. */
export function doorForKey(role: Role, key: string): Door | null {
  return doorsFor(role).find((door) => door.key === key) ?? null;
}
