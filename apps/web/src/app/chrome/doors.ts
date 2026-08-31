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

  /* Off the rail: the design reaches these by role switch, not by a door. */
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
