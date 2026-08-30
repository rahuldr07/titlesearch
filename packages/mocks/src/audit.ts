import type { AuditEntry } from "@titlepipe/contract";

/**
 * THE AUDIT LEDGER — one store, append-only, shared by every handler that
 * files a moment of record.
 *
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
 * The reference's Audit Log pane APPENDS LIVE as the session acts: a release,
 * a reissue, a countersign, an escalation ruling and a template save each add
 * a row. Until this module the mock served a frozen five-row array, so the
 * screen could never show the property the pane exists to demonstrate.
 *
 * Its own module because `handlers.ts` imports `design.ts` (and the settings
 * and templates handler modules), so the writers cannot import the store from
 * each other — the same seam `guard.ts` documents.
 *
 * NEWEST FIRST, because `GET /api/audit` serves the array verbatim and the
 * reference draws the log downward from "today". Append-only remains true in
 * the sense that matters: nothing here edits or removes a filed row.
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
 * The acting identity for an audit row — the `x-mock-actor` header where the
 * caller sent one (the same convention the countersign handler reads), else
 * the demo session's default seat.
 */
export function auditActor(request: Request): string {
  return request.headers.get("x-mock-actor") ?? "L. Vance";
}
