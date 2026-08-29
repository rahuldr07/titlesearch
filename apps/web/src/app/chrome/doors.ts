/**
 * The doors, and why this list is not the design's list.
 * `packages/contract/src/authz.ts:62-81` is the frozen door table.
 */

export type RailSection = "pipeline" | "order" | "platform" | "more";

export interface Door {
  /** Verbatim from authz.ts:62-81. Never invented. */
  readonly path: string;
  readonly label: string;
  readonly section: RailSection;
}

export const DOORS: readonly Door[] = [
  { path: "/", label: "Overview", section: "pipeline" },
  { path: "/orders-list", label: "All orders", section: "pipeline" },

  { path: "/orders", label: "Overview hub", section: "order" },
  { path: "/ingest", label: "Intake & upload", section: "order" },
  { path: "/delivery", label: "Delivered", section: "order" },

  { path: "/escalations", label: "QC & escalations", section: "platform" },
  { path: "/templates", label: "Templates architect", section: "platform" },
  { path: "/account", label: "Settings & RBAC", section: "platform" },

  /* Off the rail: the design reaches these by role switch, not by a door. */
  { path: "/blind", label: "Capture seat", section: "more" },
  { path: "/jurisdiction", label: "Jurisdiction", section: "more" },
];

/** The rubric printed above each group. ALL-CAPS is legal here (rule 4). */
export const SECTION_RUBRIC: Readonly<Record<RailSection, string>> = {
  pipeline: "Pipeline",
  order: "Active order",
  platform: "Platform tools",
  more: "More",
};

export const SECTION_ORDER: readonly RailSection[] = ["pipeline", "order", "platform"];
