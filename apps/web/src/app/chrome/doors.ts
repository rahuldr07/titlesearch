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
  // ── Pipeline ────────────────────────────────────────────────────────────
  { path: "/", label: "Overview", section: "pipeline" },
  { path: "/orders-list", label: "All orders", section: "pipeline" },

  // ── Active order ────────────────────────────────────────────────────────
  { path: "/orders", label: "Overview hub", section: "order" },

  // ── Platform tools ──────────────────────────────────────────────────────
  { path: "/escalations", label: "QC & escalations", section: "platform" },
  { path: "/templates", label: "Templates architect", section: "platform" },
  { path: "/account", label: "Settings & RBAC", section: "platform" },

  /*
   * OFF THE RAIL, STILL REACHABLE. The design draws eleven rail entries; these
   * are doors `authz.ts` grants that it does not draw. `more` is absent from
   * SECTION_ORDER, so the rail skips them while `keyboard/commands.ts` — which
   * reads DOORS whole — still offers every one in the palette. Removing them
   * from the table would make real screens unreachable; leaving them on the
   * rail is the clutter the design does not have.
   */
  { path: "/queue", label: "Queue", section: "more" },
  { path: "/ingest", label: "Intake", section: "more" },
  { path: "/dashboard", label: "Lifecycle", section: "more" },
  { path: "/delivery", label: "Delivery", section: "more" },
  { path: "/complaints", label: "Complaints", section: "more" },
  { path: "/reconciliation", label: "Reconciliation", section: "more" },
  { path: "/golden", label: "Golden set", section: "more" },
  { path: "/seed-correction", label: "Seed correction", section: "more" },
  { path: "/bench", label: "Bench", section: "more" },
  { path: "/leaderboard", label: "Engines", section: "more" },
  { path: "/blind", label: "Capture seat", section: "more" },
  { path: "/blind-status", label: "Capture status", section: "more" },
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
