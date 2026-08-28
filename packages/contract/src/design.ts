import { z } from "zod";
import { Report } from "./entities.js";

/**
 * Surface added under the 2026-08-28 owner ruling
 * (docs/frontend/design-2026-08/RULING-2026-08-28.md), so every screen the
 * reference app draws runs on real wire data.
 *
 * Nothing here changes the meaning of an existing shape. The anti-patterns the
 * ruling explicitly kept are kept: no rate, no per-person figure, no probe.
 */

// ---- All Orders -------------------------------------------------------------

export const OrderStage = z.enum([
  "unassigned",
  "intake",
  "machine",
  "gate",
  "review",
  "escalated",
  "delivered",
]);
export type OrderStage = z.infer<typeof OrderStage>;

/**
 * A row of the browse table. `due` is a SERVER-OWNED date, never a countdown:
 * the ruling permits the column because the server owns the value, and still
 * forbids a client computing "5h 20m left" from it.
 */
export const OrderRow = z.object({
  id: z.string(),
  order_ref: z.string(),
  addr: z.string(),
  place: z.string(),
  client: z.string(),
  product: z.string(),
  stage: OrderStage,
  /** Null while nobody has taken it. Never inferred from anything else. */
  assigned_to: z.string().nullable(),
  /** The server's own word for when it is due — a label, not a timestamp. */
  due: z.string().nullable(),
  pages: z.number().int().nullable(),
});
export type OrderRow = z.infer<typeof OrderRow>;

export const OrderFilter = z.enum(["all", "active", "waiting", "delivered"]);
export type OrderFilter = z.infer<typeof OrderFilter>;

/**
 * `GET /api/orders?q=&filter=&page=` — the browse surface.
 *
 * `total` and `page_count` are the SERVER'S. The caller never divides a length
 * by a page size to get either; that is the arithmetic every census member in
 * this contract exists to remove.
 */
export const OrdersPageResponse = z.object({
  orders: z.array(OrderRow),
  total: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
  page_count: z.number().int(),
  /** What the server matched on, echoed back so the screen never re-states it. */
  query: z.string(),
  filter: OrderFilter,
});
export type OrdersPageResponse = z.infer<typeof OrdersPageResponse>;

// ---- Release compiler -------------------------------------------------------

export const ManifestBlock = z.object({
  id: z.string(),
  numeral: z.string(),
  title: z.string(),
  /** Rendered body, already assembled server-side. */
  body: z.string(),
  field_count: z.number().int(),
  cited: z.number().int(),
});
export type ManifestBlock = z.infer<typeof ManifestBlock>;

export const GateCheck = z.object({
  id: z.string(),
  label: z.string(),
  /** The server's verdict. The client never evaluates a gate. */
  passed: z.boolean(),
  detail: z.string().nullable(),
});
export type GateCheck = z.infer<typeof GateCheck>;

export const CompositionResponse = z.object({
  order_id: z.string(),
  template_version: z.string(),
  blocks: z.array(ManifestBlock),
  gates: z.array(GateCheck),
  /** Server-decided: may this order be released at all, and if not, why. */
  releasable: z.boolean(),
  blocked_reason: z.string().nullable(),
  /** Present once a release has been executed. */
  seal_sha256: z.string().nullable(),
});
export type CompositionResponse = z.infer<typeof CompositionResponse>;

/** `POST /api/orders/{id}/release` — refused without the signature. */
export const ReleaseRequest = z.object({
  signature: z.string().min(1),
});
export type ReleaseRequest = z.infer<typeof ReleaseRequest>;

export const ReleaseResponse = z.object({
  order_id: z.string(),
  version: z.number().int(),
  seal_sha256: z.string(),
  released_at: z.string(),
});
export type ReleaseResponse = z.infer<typeof ReleaseResponse>;

// ---- Deliverables -----------------------------------------------------------

/** The artifact `Report` never carried: a digest, a size and a retrieval path. */
export const Artifact = z.object({
  id: z.string(),
  report_id: z.string(),
  filename: z.string(),
  media_type: z.string(),
  bytes: z.number().int(),
  sha256: z.string(),
  href: z.string(),
});
export type Artifact = z.infer<typeof Artifact>;

export const ArtifactsResponse = z.object({ artifacts: z.array(Artifact) });
export type ArtifactsResponse = z.infer<typeof ArtifactsResponse>;

/** `POST /api/deliveries/{id}/reissue` — refused without its reason. */
export const ReissueRequest = z.object({
  reason: z.string().min(1),
});
export type ReissueRequest = z.infer<typeof ReissueRequest>;

export const ReissueResponse = z.object({
  report: Report,
  supersedes: z.number().int(),
  reason: z.string(),
});
export type ReissueResponse = z.infer<typeof ReissueResponse>;

// ---- T1 second read ---------------------------------------------------------

export const Countersign = z.object({
  id: z.string(),
  field_id: z.string(),
  ruled_by: z.string(),
  countersigned_by: z.string(),
  at: z.string(),
});
export type Countersign = z.infer<typeof Countersign>;

export const CountersignsResponse = z.object({
  order_id: z.string(),
  /** Fields carrying ruinous exposure, as the SERVER classifies them. */
  required: z.array(
    z.object({
      field_id: z.string(),
      path: z.string(),
      value: z.string().nullable(),
      ruled_by: z.string(),
      countersigned_by: z.string().nullable(),
    }),
  ),
});
export type CountersignsResponse = z.infer<typeof CountersignsResponse>;

/**
 * `POST /api/fields/{id}/countersign` — design rule 13: a second read must come
 * from a different user than the ruling examiner, enforced as a 409 rather than
 * as button state.
 */
export const CountersignRequest = z.object({
  signature: z.string().min(1),
});
export type CountersignRequest = z.infer<typeof CountersignRequest>;
