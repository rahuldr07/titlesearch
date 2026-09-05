import { seatOf } from "./guard.js";
import type { AuditEntry } from "@titlepipe/contract";

/**
 * The audit ledger — one store, append-only, shared by every handler that
 * files a moment of record; this module must be the only writer. Its own
 * module because `handlers.ts` imports `design.ts`, so the writers cannot
 * import the store from each other (the same seam `guard.ts` documents).
 * Newest first: `GET /api/audit` serves the array verbatim. Nothing here
 * edits or removes a filed row.
 */
export const auditStore: AuditEntry[] = [
  {
    id: "aud_5",
    actor_id: "m.okafor",
    action: "engine_seat_change",
    entity: "engine_routing",
    entity_id: "rt_B_hartford-ct_judgments_liens",
    at: "2026-07-12T09:41:00Z",
  },
  {
    id: "aud_4",
    actor_id: "M. Estrada",
    action: "golden_correction",
    entity: "golden_fields",
    entity_id: "gf_2",
    at: "2026-07-09T14:02:00Z",
  },
  {
    id: "aud_3",
    actor_id: "M. Estrada",
    action: "escalation_resolved",
    entity: "escalations",
    entity_id: "esc_tax_1",
    at: "2026-07-09T11:20:00Z",
  },
  {
    id: "aud_2",
    actor_id: "eng_demo",
    action: "rule_confirmed",
    entity: "rules",
    entity_id: "rule_tax_vintage",
    at: "2026-07-09T10:05:00Z",
  },
  {
    id: "aud_1",
    actor_id: "L. Vance",
    action: "field_confirmed",
    entity: "fields",
    entity_id: "fld_owner",
    at: "2026-07-08T15:44:00Z",
  },
];

let liveCount = 0;

/** The ledger as seeded, captured before any live append — for the demo reset. */
const seedEntries: readonly AuditEntry[] = auditStore.map((e) => ({ ...e }));

/**
 * Drop every live-appended row, restoring the seeded ledger. Called only by
 * `POST /api/demo/reset` (handlers.ts) — the demo re-seed, not an edit of a
 * filed row; handlers still never modify or remove entries.
 */
export function resetAuditStore(): void {
  liveCount = 0;
  auditStore.splice(0, auditStore.length, ...seedEntries.map((e) => ({ ...e })));
}

/** File one event at the head of the ledger. The instant is the server's. */
export function appendAudit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
): void {
  liveCount += 1;
  auditStore.unshift({
    id: `aud_live_${String(liveCount)}`,
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    at: new Date().toISOString(),
  });
}

/**
 * The acting identity for an audit row, resolved from the credential.
 *
 * It used to read `x-mock-actor` — a free-text header — so an audit ledger,
 * whose entire job is saying who did a thing, recorded whatever name the
 * caller typed into it. Every writer here runs after `guard`, so the seat is
 * present; `"unknown"` is the shape of a row nobody can produce rather than a
 * default anybody can claim, and it is not a name any seat holds.
 */
export function auditActor(request: Request): string {
  return seatOf(request)?.actor ?? "unknown";
}
