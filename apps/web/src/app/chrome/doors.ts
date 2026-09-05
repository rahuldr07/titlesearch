/**
 * The doors. The authz table in `packages/contract` is the frozen door
 * list; nothing here invents a path.
 */

export type RailSection = "pipeline" | "order" | "platform" | "more";

export interface Door {
  /** Verbatim from the authz door table. Never invented. */
  readonly path: string;
  readonly label: string;
  readonly section: RailSection;
}

/* Labels keep the design's own copy and casing. */
export const DOORS: readonly Door[] = [
  { path: "/", label: "Overview", section: "pipeline" },
  { path: "/orders-list", label: "All Orders", section: "pipeline" },

  { path: "/orders", label: "Overview Hub", section: "order" },
  /* Intake and Delivered ride the numbered stage rows (`ActiveOrderStages`)
     — a flat door beside the same row would print the destination twice. */
  { path: "/ingest", label: "Intake & Upload", section: "more" },
  { path: "/delivery", label: "Delivered", section: "more" },

  { path: "/escalations", label: "QC & Escalations", section: "platform" },
  { path: "/templates", label: "Templates Architect", section: "platform" },
  { path: "/account", label: "Settings & RBAC", section: "platform" },

  /*
   * Off the rail: the design reaches these by role switch, not by a door.
   *
   * `/queue` is here for a different reason and it is worth stating, because
   * "more" reads like a junk drawer. authz.ts:62 grants `screen.queue.enter`
   * to reviewer and admin, so the door is real; reference-app.html draws no
   * rail entry for it, so putting one under Pipeline would be inventing an
   * affordance the ruling source of truth does not have. The palette reads
   * DOORS whole, so the screen is reachable without one. Whether a reviewer's
   * primary surface should be palette-only is a product question, written up
   * in docs/frontend/CONTRACT-GAP-queue.md — it is one line in this file
   * either way, and it is not a line to add unilaterally.
   */
  { path: "/queue", label: "Queue", section: "more" },
  { path: "/blind", label: "Capture seat", section: "more" },
  { path: "/jurisdiction", label: "Jurisdiction", section: "more" },
];

/** The rubric printed above each group. */
export const SECTION_RUBRIC: Readonly<Record<RailSection, string>> = {
  pipeline: "Pipeline",
  order: "Active order",
  platform: "Platform tools",
  more: "More",
};

export const SECTION_ORDER: readonly RailSection[] = ["pipeline", "order", "platform"];
