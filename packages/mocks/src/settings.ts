import { http, HttpResponse } from "msw";
import {
  RbacCycleRequest,
  PersonRoleRequest,
  type RbacLevel,
  type RbacMatrixResponse,
} from "@titlepipe/contract";
import { guard, err } from "./guard.js";
import { appendAudit, auditActor } from "./audit.js";
import { people } from "./workspace.js";

/**
 * Settings & RBAC handlers — the Access Control matrix and the People
 * pane's role picker. One mutable matrix, reset on reload like every other
 * store here. The cycle order (— → VIEW → EDIT → —) lives here, server-side:
 * the client posts the cell it clicked and repaints from the answer.
 */

/** Column order — also the People picker's role vocabulary. */
const ROLES4 = ["Admin", "Typist (Reviewer)", "QC Reviewer", "Engineer"] as const;

const LEVELS: readonly RbacLevel[] = ["none", "view", "edit"];

interface SeedRow {
  id: string;
  module: string;
  label: string;
  note: string;
  live: boolean;
  /** Levels per ROLES4 column, as level indices (0 —, 1 VIEW, 2 EDIT). */
  d: readonly [number, number, number, number];
}

const SEED: readonly SeedRow[] = [
  { id: "orders.intake", module: "Orders", label: "Upload & intake", note: "sign for packages", live: false, d: [2, 2, 1, 0] },
  { id: "orders.extraction", module: "Orders", label: "Extraction", note: "pipeline, page quality", live: false, d: [2, 1, 1, 2] },
  { id: "orders.review", module: "Orders", label: "Review workstation", note: "confirm · correct · absences · T1 countersign", live: true, d: [2, 2, 1, 0] },
  { id: "orders.composer", module: "Orders", label: "Report composer", note: "compose · requirements", live: false, d: [2, 2, 2, 0] },
  { id: "orders.delivery", module: "Orders", label: "Delivery & reissue", note: "sign and send", live: false, d: [2, 0, 1, 0] },
  { id: "queries.raise", module: "Queries", label: "Raise a query", note: "from review", live: false, d: [2, 2, 2, 0] },
  { id: "queries.answer", module: "Queries", label: "Answer as QC", note: "attach · exclude · re-search", live: true, d: [2, 0, 2, 0] },
  { id: "library.templates", module: "Library", label: "Templates", note: "blocks · samples · publish", live: true, d: [2, 1, 1, 2] },
  { id: "settings.people", module: "Settings", label: "People & access", note: "this screen", live: true, d: [2, 0, 0, 1] },
  { id: "settings.audit", module: "Settings", label: "Audit log", note: "append-only", live: false, d: [2, 0, 1, 2] },
];

/** Live levels, mutated by the cycle PATCH. Keyed `${row.id}:${role}`. */
const levels = new Map<string, RbacLevel>();
for (const row of SEED) {
  ROLES4.forEach((role, i) => {
    levels.set(`${row.id}:${role}`, LEVELS[row.d[i] ?? 0] ?? "none");
  });
}

function matrix(): RbacMatrixResponse {
  return {
    roles: [...ROLES4],
    rows: SEED.map((row) => ({
      id: row.id,
      module: row.module,
      label: row.label,
      note: row.note,
      live: row.live,
      cells: ROLES4.map((role) => ({
        role,
        level: levels.get(`${row.id}:${role}`) ?? "none",
        // The Admin column never cycles.
        locked: role === "Admin",
      })),
    })),
  };
}

export const settingsHandlers = [
  http.get("/api/rbac", () => HttpResponse.json(matrix())),

  /** One cell cycles — the server owns the order, the client repaints. */
  http.patch("/api/rbac", async ({ request }) => {
    const denied = guard(request, "rbac.edit");
    if (denied) return denied;
    const parsed = RbacCycleRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const { row_id, role } = parsed.data;
    const row = SEED.find((r) => r.id === row_id);
    if (row === undefined) return err("no such access row", 404);
    if (!(ROLES4 as readonly string[]).includes(role)) return err("no such role column", 404);
    if (role === "Admin") {
      return err("the Admin column is locked — an admin's access is not editable here", 409);
    }
    const key = `${row_id}:${role}`;
    const current = levels.get(key) ?? "none";
    const next = LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length] ?? "none";
    levels.set(key, next);
    appendAudit(
      auditActor(request),
      "rbac_cell_cycled",
      "rbac",
      `${row_id}:${role}→${next}`,
    );
    return HttpResponse.json(matrix());
  }),

  /** The People pane's role picker. Role vocabulary is the matrix's columns. */
  http.patch("/api/people/:id/role", async ({ params, request }) => {
    const denied = guard(request, "person.role.assign");
    if (denied) return denied;
    const parsed = PersonRoleRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const person = people.people.find((p) => p.id === String(params["id"]));
    if (person === undefined) return err("no such person", 404);
    if (!(ROLES4 as readonly string[]).includes(parsed.data.role)) {
      return err("unknown role — the vocabulary is the RBAC matrix's columns", 422);
    }
    person.role = parsed.data.role;
    appendAudit(auditActor(request), "person_role_assigned", "people", person.id);
    return HttpResponse.json({ ok: true });
  }),
];
