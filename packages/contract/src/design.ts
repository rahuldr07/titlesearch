import { z } from "zod";
import { Report } from "./entities.js";

/**
 * Wire shapes for the reference app's screens. Nothing here changes the
 * meaning of an existing shape, and the anti-patterns hold: no rate, no
 * per-person figure, no probe.
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
 * A row of the browse table. `due` is a server-owned label, never a
 * countdown — a client must not compute "5h 20m left" from it.
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
 * `GET /api/orders?q=&filter=&page=` — the browse surface. `total` and
 * `page_count` are the server's; the caller never divides a length by a
 * page size to get either.
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

/**
 * One labelled row of a manifest block. A pending value — still awaiting an
 * examiner ruling — is clickable, jumping to that field on the examination
 * workstation; `field_id` is the field path the jump lands on (`?field=`),
 * null on a settled row. The pending flag is the server's: the client never
 * derives "pending" from the composition's gates.
 */
export const ManifestValue = z.object({
  label: z.string(),
  value: z.string(),
  pending: z.boolean(),
  field_id: z.string().nullable(),
});
export type ManifestValue = z.infer<typeof ManifestValue>;

export const ManifestBlock = z.object({
  id: z.string(),
  numeral: z.string(),
  title: z.string(),
  /** The block's rows, already assembled server-side. */
  values: z.array(ManifestValue),
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
  /**
   * Which step blocks release is release resolution, so the server names
   * the door: a route path the blocked line links to, null when nothing
   * blocks. The client draws the link verbatim and never chooses a
   * destination by counting gates.
   */
  blocked_door: z.string().nullable(),
  /** Present once a release has been executed. */
  seal_sha256: z.string().nullable(),
  /** The instant the seal was filed. Null until a release files one. */
  released_at: z.string().nullable(),
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

/**
 * `GET /api/reissue/reasons` — the canned reasons the Reissue Gateway offers
 * as radio options. Server-owned vocabulary: the pipeline defines what may
 * go on the lender's record, so the list is served, not spelled in a
 * component.
 */
export const ReissueReasonsResponse = z.object({
  reasons: z.array(z.string()),
});
export type ReissueReasonsResponse = z.infer<typeof ReissueReasonsResponse>;

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
 * `POST /api/fields/{id}/countersign` — a second read must come from a
 * different user than the ruling examiner, enforced as a 409 rather than as
 * button state.
 */
export const CountersignRequest = z.object({
  signature: z.string().min(1),
});
export type CountersignRequest = z.infer<typeof CountersignRequest>;

// ---- Settings & RBAC --------------------------------------------------------

/**
 * The Access Control pane's full matrix — every module row against every
 * role, cells reading — / VIEW / EDIT, a click cycling the cell:
 * - `GET /api/rbac` serves the whole matrix — a settings document about the
 *   shop, distinct from `/api/me/permissions` (this seat's enforceable
 *   projection); neither derives from the other in the browser.
 * - `PATCH /api/rbac` posts one cell; the server owns the cycle order and
 *   answers with the whole matrix re-read.
 * `locked` marks a cell the server refuses to cycle (the Admin column).
 */
export const RbacLevel = z.enum(["none", "view", "edit"]);
export type RbacLevel = z.infer<typeof RbacLevel>;

export const RbacCell = z.object({
  role: z.string(),
  level: RbacLevel,
  locked: z.boolean(),
});
export type RbacCell = z.infer<typeof RbacCell>;

export const RbacRow = z.object({
  id: z.string(),
  module: z.string(),
  label: z.string(),
  note: z.string(),
  /** The reference's "live" pill — this row is enforced in the prototype. */
  live: z.boolean(),
  cells: z.array(RbacCell),
});
export type RbacRow = z.infer<typeof RbacRow>;

export const RbacMatrixResponse = z.object({
  /** Column order, and the role vocabulary the People pane's picker offers. */
  roles: z.array(z.string()),
  rows: z.array(RbacRow),
});
export type RbacMatrixResponse = z.infer<typeof RbacMatrixResponse>;

/** One cell named by row and role; the server cycles it. */
export const RbacCycleRequest = z.object({
  row_id: z.string(),
  role: z.string(),
});
export type RbacCycleRequest = z.infer<typeof RbacCycleRequest>;

/**
 * `PATCH /api/people/{id}/role` — the People pane's role picker. The role
 * must be one of `RbacMatrixResponse.roles`; the server refuses anything
 * else.
 */
export const PersonRoleRequest = z.object({
  role: z.string().min(1),
});
export type PersonRoleRequest = z.infer<typeof PersonRoleRequest>;
