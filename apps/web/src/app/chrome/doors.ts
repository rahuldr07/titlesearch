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

/* Casing is the reference app's own (RULING-2026-08-29 — match copy and
   casing): "All Orders", "Overview Hub", "QC & Escalations", "Templates
   Architect", exactly as its rail prints them. */
export const DOORS: readonly Door[] = [
  { path: "/", label: "Overview", section: "pipeline" },
  { path: "/orders-list", label: "All Orders", section: "pipeline" },

  { path: "/orders", label: "Overview Hub", section: "order" },
  /* Intake and Delivered ride the numbered stage rows (`ActiveOrderStages`),
     as the reference draws them — a flat door beside the same row printed the
     destination twice (RULING-2026-08-29). */
  { path: "/ingest", label: "Intake & Upload", section: "more" },
  { path: "/delivery", label: "Delivered", section: "more" },

  { path: "/escalations", label: "QC & Escalations", section: "platform" },
  { path: "/templates", label: "Templates Architect", section: "platform" },
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
