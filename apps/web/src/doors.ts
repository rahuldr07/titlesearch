/**
 * The doors — the one canonical list of screen destinations. The home hub
 * (Home.tsx) and the header nav (shared/ui/AppHeader.tsx) both render from this;
 * the keyboard chords (GlobalKeys.GO) mirror the same `key`→`to` pairing.
 * Keep the three in sync by keeping the source here.
 *
 * This is NOT a permission list — a door only appears for a role that holds it,
 * filtered through `canAccess` at every consumer (§0.7, absent never dimmed).
 * The order is the reading order of the hub grid and the rail.
 */
/**
 * Doors group by where they sit in the pipeline of work. The rail draws a
 * muted header per group (role-aware — a group with no doors in this world
 * doesn't render its header); the hub renders the flat grid and ignores the
 * grouping. `account` is pinned last, headerless.
 */
export type DoorGroup = "pipeline" | "outcomes" | "measurement" | "account";

export interface Door {
  /** the `g <key>` chord letter — mirrors GlobalKeys.GO */
  key: string;
  to: string;
  label: string;
  desc: string;
  group: DoorGroup;
}

export const DOORS: Door[] = [
  { key: "q", to: "/queue", label: "REVIEW QUEUE", group: "pipeline", desc: "the next order decides — you don't shop" },
  { key: "i", to: "/ingest", label: "INGEST", group: "pipeline", desc: "check the manifest, sign for it, move it on" },
  { key: "e", to: "/escalations", label: "ESCALATION INBOX", group: "pipeline", desc: "every item is a reviewer saying “I don't know the rule”" },
  { key: "d", to: "/dashboard", label: "READOUT", group: "outcomes", desc: "paired signals; the catch rate is the only headline" },
  { key: "v", to: "/delivery", label: "DELIVERY", group: "outcomes", desc: "turnaround closes here; v1 + v2 is the defect record" },
  { key: "c", to: "/complaints", label: "COMPLAINTS", group: "outcomes", desc: "grouped by how it got through — the grouping is the finding" },
  { key: "o", to: "/golden", label: "GOLDEN SET", group: "measurement", desc: "provenance-tagged ground truth" },
  { key: "b", to: "/bench", label: "EXTRACTION BENCH", group: "measurement", desc: "prompts against the worst pages" },
  { key: "r", to: "/bench/results", label: "BENCH RESULTS", group: "measurement", desc: "section × tag matrix; a failing cell opens the seed" },
  { key: "l", to: "/leaderboard", label: "ENGINE LEADERBOARD", group: "measurement", desc: "per-cell winners on purpose — there is no best engine" },
  { key: "s", to: "/blind-status", label: "BLIND FIFTY STATUS", group: "measurement", desc: "coverage funnel toward the ≥40 judgment gate" },
  { key: "a", to: "/account", label: "ACCOUNT", group: "account", desc: "rulebook · audit · me" },
];

/** Group order + display headers for the rail. `account` renders headerless. */
export const DOOR_GROUPS: { group: DoorGroup; header: string | null }[] = [
  { group: "pipeline", header: "PIPELINE" },
  { group: "outcomes", header: "OUTCOMES" },
  { group: "measurement", header: "MEASUREMENT" },
  { group: "account", header: null },
];
