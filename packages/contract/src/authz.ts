/**
 * The authorization table — policy as versioned data, one file to audit.
 *
 * Three layers share this file so they cannot drift:
 *   - apps/web derives route entry (nav), door rendering, and action
 *     affordances from it;
 *   - packages/mocks enforces it on every mutation (403), standing in for
 *     core-api middleware;
 *   - core-api will import it directly (Hono/Bun) or consume it as emitted
 *     JSON (FastAPI) — the PDP is this data either way.
 *
 * Division of enforcement (deliberate):
 *   - `roles` answers "may this role ever do this" — checked in UI and on
 *     the server for every request.
 *   - `when` is the coarse resource-state gate ("resolve only while open") —
 *     policy documentation now, server-checked at P1. The FINE state machine
 *     (bug-5 idempotent confirm, terminal 409s, chain rules) stays in server
 *     handler logic and is NEVER re-derived from this table.
 *
 * Rules of the table:
 *   - Every holder is listed EXPLICITLY — there is no wildcard role. (The
 *     old nav.ts WORLDS map made "/" a wildcard and it nearly leaked; admin
 *     is spelled out on every row instead.)
 *   - Action names are resource.verb — greppable, and safe for logs/URLs
 *     (no NPI, no ids; GLBA).
 *   - Clients receive only their own role's projection (`rulesFor`) — a
 *     typist's rule set does not MENTION other worlds. Doors absent, never
 *     dimmed, extends to the data itself.
 */

export const ROLES = [
  "reviewer",
  "senior",
  "ops",
  "engineer",
  "typist",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export interface Permission {
  /** resource.verb (actions) or screen.<name>.enter (route entry) */
  action: string;
  /** every holder explicit — no wildcards */
  roles: readonly Role[];
  /** screen-entry permissions guard this route prefix ("/" matches exactly) */
  path?: string;
  /** coarse resource-state gate: each key's value must be in its allow-list */
  when?: Readonly<Record<string, readonly (string | null)[]>>;
}

const EVERYONE = ROLES;
const SIGHTED = ["reviewer", "senior", "ops", "engineer", "admin"] as const;

export const PERMISSIONS = [
  /* ── doors ───────────────────────────────────────────────────────────── */
  // typists never see the hub — straight to the capture seat (§0.7)
  { action: "screen.home.enter", path: "/", roles: SIGHTED },
  { action: "screen.queue.enter", path: "/queue", roles: ["reviewer", "admin"] },
  // order-scoped review: reviewer works it; senior/ops/engineer arrive via
  // context-carrying deep links (escalation clusters, complaint retros)
  { action: "screen.review.enter", path: "/orders", roles: SIGHTED },
  { action: "screen.ingest.enter", path: "/ingest", roles: ["ops", "admin"] },
  { action: "screen.escalations.enter", path: "/escalations", roles: ["senior", "admin"] },
  { action: "screen.dashboard.enter", path: "/dashboard", roles: ["ops", "admin"] },
  { action: "screen.delivery.enter", path: "/delivery", roles: ["ops", "admin"] },
  { action: "screen.complaints.enter", path: "/complaints", roles: ["ops", "admin"] },
  { action: "screen.golden.enter", path: "/golden", roles: ["engineer", "admin"] },
  { action: "screen.seed-correction.enter", path: "/seed-correction", roles: ["senior", "engineer", "admin"] },
  { action: "screen.bench.enter", path: "/bench", roles: ["engineer", "admin"] },
  { action: "screen.leaderboard.enter", path: "/leaderboard", roles: ["engineer", "admin"] },
  { action: "screen.blind.enter", path: "/blind", roles: ["typist", "admin"] },
  { action: "screen.blind-status.enter", path: "/blind-status", roles: ["ops", "admin"] },
  { action: "screen.reconciliation.enter", path: "/reconciliation", roles: ["senior", "admin"] },
  // every role keeps the account door in the mock-auth phase (role switch
  // must not lock you out); Clerk narrows this at P1
  { action: "screen.account.enter", path: "/account", roles: EVERYONE },
  // added under the 2026-08-28 ruling
  { action: "screen.orders-list.enter", path: "/orders-list", roles: ["ops", "senior", "admin"] },
  { action: "screen.templates.enter", path: "/templates", roles: ["engineer", "admin"] },
  { action: "screen.jurisdiction.enter", path: "/jurisdiction", roles: ["senior", "engineer", "admin"] },

  /* ── actions ─────────────────────────────────────────────────────────── */
  { action: "order.create", roles: ["ops", "admin"] },
  { action: "release.compile", roles: ["ops", "admin"] },
  { action: "release.execute", roles: ["ops", "admin"] },
  { action: "delivery.reissue", roles: ["ops", "admin"] },
  { action: "field.countersign", roles: ["senior", "admin"] },
  { action: "template.edit", roles: ["engineer", "admin"] },
  { action: "order.accept", roles: ["ops", "admin"] },
  { action: "order.pass", roles: ["reviewer", "admin"] },
  {
    action: "field.confirm",
    roles: ["reviewer", "senior", "admin"],
    when: { state: ["needs_review", "confirmed", "auto_confirmed"] },
  },
  {
    action: "field.correct",
    roles: ["reviewer", "senior", "admin"],
    when: { state: ["needs_review", "confirmed", "auto_confirmed"] },
  },
  {
    action: "field.escalate",
    roles: ["reviewer", "senior", "admin"],
    when: { state: ["needs_review", "confirmed", "auto_confirmed"] },
  },
  // broken inputs route to engineering — anyone in the pipeline may file
  { action: "bug.file", roles: ["reviewer", "senior", "ops", "engineer", "admin"] },
  { action: "escalation.resolve", roles: ["senior", "admin"], when: { resolution: [null] } },
  { action: "rule.confirm", roles: ["engineer", "admin"], when: { status: ["pending"] } },
  { action: "golden.correct", roles: ["senior", "engineer", "admin"] },
  // the other two seed actions — affirm value as-is (→ ruled) / demote (→ suspect)
  { action: "golden.confirm", roles: ["senior", "engineer", "admin"] },
  { action: "golden.demote", roles: ["senior", "engineer", "admin"] },
  // admin here is mock-phase dev convenience (the demo session is admin);
  // under Clerk the blind protocol narrows this to the seated typist
  { action: "blind.submit", roles: ["typist", "admin"] },
  { action: "reconciliation.rule", roles: ["senior", "admin"] },
  { action: "routing.flip", roles: ["engineer", "admin"] },
  { action: "complaint.record", roles: ["ops", "admin"] },
  // ops lead resolves complaints (PRD §5); refused unless still open
  { action: "complaint.resolve", roles: ["ops", "admin"], when: { resolution: [null] } },
  { action: "delivery.retry", roles: ["ops", "admin"] },
  // ⚠ RULED 2026-08-29 (RULING-2026-08-29.md): the reference's Settings pane
  // cycles RBAC cells and reassigns roles; both acts get real grants so the
  // mock refuses them by the one table rather than by a hand-rolled check.
  { action: "rbac.edit", roles: ["admin"] },
  { action: "person.role.assign", roles: ["admin"] },
] as const satisfies readonly Permission[];

/** Compile-time-safe action names — a typo in a canDo call fails typecheck. */
export type Action = (typeof PERMISSIONS)[number]["action"];

const ALL: readonly Permission[] = PERMISSIONS;

const byAction = new Map<string, Permission>();
for (const p of ALL) {
  if (byAction.has(p.action)) {
    // duplicate rows would make "which rule applied" ambiguous — fail loud
    throw new Error(`authz: duplicate permission action "${p.action}"`);
  }
  byAction.set(p.action, p);
}

const doors = ALL.filter(
  (p): p is Permission & { path: string } => typeof p.path === "string",
);

/**
 * Route entry. "/" matches only itself — a "/" prefix would be a wildcard,
 * which is exactly the trap this table exists to remove.
 */
export function canAccess(role: Role, path: string): boolean {
  return doors.some(
    (d) =>
      d.roles.includes(role) &&
      (path === d.path || (d.path !== "/" && path.startsWith(`${d.path}/`))),
  );
}

/**
 * PARC check: may this principal take this action (on this resource)?
 * Without a resource it is the coarse role gate; with one, the `when`
 * condition must also hold. Unknown actions are refused, never allowed.
 */
export function canDo(
  role: Role,
  action: Action,
  resource?: Readonly<Record<string, unknown>>,
): boolean {
  const p = byAction.get(action);
  if (p === undefined) return false;
  if (!p.roles.includes(role)) return false;
  if (p.when === undefined || resource === undefined) return true;
  return Object.entries(p.when).every(([key, allowed]) => {
    const value = resource[key];
    if (value !== null && typeof value !== "string") return false;
    return allowed.includes(value);
  });
}

/** A permission as a client receives it — the holder list is redacted. */
export type GrantedPermission = Omit<Permission, "roles">;

/**
 * The per-role projection served to clients (GET /api/me/permissions at P1).
 * Contains ONLY this role's grants: other roles' capabilities are
 * unrepresented, not hidden — shipping the full matrix would leak the
 * existence of forbidden capabilities to every client.
 */
export function rulesFor(role: Role): GrantedPermission[] {
  return ALL.filter((p) => p.roles.includes(role)).map((p) => {
    const granted: GrantedPermission = { action: p.action };
    if (p.path !== undefined) granted.path = p.path;
    if (p.when !== undefined) granted.when = p.when;
    return granted;
  });
}
