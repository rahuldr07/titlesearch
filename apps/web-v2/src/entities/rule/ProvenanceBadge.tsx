import { Chip } from "../../shared/ui/Chip";

/**
 * Where a thing came from. `RuleProvenance` in the contract, and the design
 * renders all four correctly coloured.
 *
 * TWO OF THESE ARE NOT CHOSEN. The design states it and it is worth keeping in
 * the code: *"OPEN and CONFLICT are assigned by the machine, not chosen"* — you
 * cannot author a rule into a state it can never leave. The component takes
 * what the server says and renders it; there is no path from the UI to these
 * values.
 *
 * THERE IS NO `unknown` VARIANT, deliberately. Principle 6 generalised to
 * config: *"a line with no traceable source is a config defect, the same
 * discipline as field provenance."* A badge for "we don't know" would make the
 * defect look like a state.
 */
export type RuleProvenance = "RULED" | "DERIVED" | "OPEN" | "CONFLICT";

const TONE = {
  // A human ruled it — settled, no action.
  RULED: "settled",
  // The machine derived it from a rule that was ruled. Traceable, not authored.
  DERIVED: "action",
  // Machine-assigned: no rule covers this yet. Someone must answer.
  OPEN: "attend",
  // Machine-assigned: two rules disagree. Stopped, actionable.
  CONFLICT: "halt",
} as const satisfies Record<RuleProvenance, "settled" | "action" | "attend" | "halt">;

export function ProvenanceBadge({ provenance }: { provenance: RuleProvenance }) {
  return (
    <Chip tone={TONE[provenance]} shape="pill" size="micro" bordered>
      {provenance}
    </Chip>
  );
}

/**
 * Where a config line came from. Same discipline, different vocabulary — a line
 * is inherited from the baseline, narrowed, replaced, or added for this client.
 * Overrides are stored as deltas, never as a copy, so every line can say which
 * it is.
 */
export type LineOrigin = "baseline" | "narrowed" | "replaced" | "added";

const ORIGIN_TONE = {
  baseline: "neutral",
  narrowed: "attend",
  replaced: "action",
  added: "settled",
} as const satisfies Record<LineOrigin, "neutral" | "attend" | "action" | "settled">;

export function OriginLabel({ origin }: { origin: LineOrigin }) {
  return (
    <Chip tone={ORIGIN_TONE[origin]} size="micro">
      {origin}
    </Chip>
  );
}
