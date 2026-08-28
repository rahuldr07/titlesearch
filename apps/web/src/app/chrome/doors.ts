/**
 * The doors, and why this list is not the design's list.
 * `packages/contract/src/authz.ts:62-81` is the frozen door table.
 */

export type RailSection = "pipeline" | "order" | "platform";

export interface Door {
  /** Verbatim from authz.ts:62-81. Never invented. */
  readonly path: string;
  readonly label: string;
  readonly section: RailSection;
}

export const DOORS: readonly Door[] = [
  // ── Pipeline ────────────────────────────────────────────────────────────
  { path: "/", label: "Overview", section: "pipeline" },
  { path: "/queue", label: "Queue", section: "pipeline" },
  { path: "/ingest", label: "Intake", section: "pipeline" },
  { path: "/dashboard", label: "Lifecycle", section: "pipeline" },
  { path: "/delivery", label: "Delivery", section: "pipeline" },

  // ── Active order ────────────────────────────────────────────────────────
  // One door, not five numbered stages. See the header.
  { path: "/orders", label: "Review", section: "order" },

  // ── Platform tools ──────────────────────────────────────────────────────
  { path: "/escalations", label: "Escalations", section: "platform" },
  { path: "/complaints", label: "Complaints", section: "platform" },
  { path: "/reconciliation", label: "Reconciliation", section: "platform" },
  { path: "/golden", label: "Golden set", section: "platform" },
  { path: "/seed-correction", label: "Seed correction", section: "platform" },
  { path: "/bench", label: "Bench", section: "platform" },
  { path: "/leaderboard", label: "Engines", section: "platform" },
  { path: "/blind", label: "Capture seat", section: "platform" },
  { path: "/blind-status", label: "Capture status", section: "platform" },
  { path: "/account", label: "Account", section: "platform" },
];

/** The rubric printed above each group. ALL-CAPS is legal here (rule 4). */
export const SECTION_RUBRIC: Readonly<Record<RailSection, string>> = {
  pipeline: "Pipeline",
  order: "Active order",
  platform: "Platform tools",
};

export const SECTION_ORDER: readonly RailSection[] = ["pipeline", "order", "platform"];
