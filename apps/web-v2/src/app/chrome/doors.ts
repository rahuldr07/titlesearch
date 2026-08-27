/**
 * THE DOORS, AND WHY THIS LIST IS NOT THE DESIGN'S LIST.
 *
 * `packages/contract/src/authz.ts:62-81` is the frozen door table. A screen at
 * a path not in that list is unreachable by design, so every `path` below is
 * copied from it verbatim and nothing here invents one.
 *
 * The design's §App shell asks for three sections — Pipeline / Active Order /
 * Platform Tools — and those survive: they are a grouping of doors, which is a
 * presentation decision the rail is allowed to make. What does NOT survive is
 * the design's *content* for the middle section, and the reason is recorded in
 * `docs/frontend/design-2026-08/ANALYSIS-screens.md` §3:
 *
 *   > "stages 1-5" (sidebar rail) → `FieldState` (6 members) ≠
 *   > `PipelineStage`/`StagePhase` (4) ≠ `StageKind` (4). THREE DIFFERENT STATE
 *   > MACHINES. The design collapses them into one 1-5 rail. Do not.
 *
 * So the Active Order section carries the order-scoped DOOR (`/orders`) and the
 * server's own lifecycle stamp, not five numbered stages with client-decided
 * state dots. Numbering them would require the browser to decide which machine
 * a stage belongs to and which dot it earns, which is hard rule 3.
 *
 * `label` is the word the rail prints. Where the design's word and the
 * contract's word differ, the CONTRACT wins (ANALYSIS §3): "Examination
 * Workstation" is Review, "QC determinations" is Escalations, "queries" is
 * escalations. Sentence case throughout (rule 4) — the ALL-CAPS is on the
 * section rubrics only, which is one of the two places rule 4 permits it.
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
