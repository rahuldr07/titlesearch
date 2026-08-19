import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";
import type { RuleCounts } from "./RulebookHeader";

/** The contract's three `RuleStatus` values, plus the unfiltered book. */
export type RuleFilterKey = "live" | "pending" | "retired" | "all";

const KEYS: readonly RuleFilterKey[] = ["live", "pending", "retired", "all"];
const LABELS: Record<RuleFilterKey, string> = {
  live: "Live",
  pending: "Pending",
  retired: "Retired",
  all: "All",
};

/**
 * The filter row. Every pill carries its own count, because the count is the
 * reason to press it — a filter that hides how much is behind it invites you to
 * never look.
 *
 * RETIRED IS A FILTER, NOT A DELETION. Nothing leaves this book; a rule that
 * stopped applying is still the explanation for every report that was written
 * while it did. The pill has to exist or the retired shelf becomes unreachable,
 * which is the same thing as deleting it from the reader's point of view.
 *
 * CONTRACT GAP: the design also draws Conflict and Open pills, and its third
 * masthead stat is CONFLICT. Both are facets of the provenance tag — the
 * export counts `tag === 'CONFLICT' && status !== 'RETIRED'` and the same for
 * OPEN — and while `RuleProvenance` exists in the contract's enums, `Rule`
 * carries `origin`, a different axis. Neither pill can be populated or
 * filtered until `provenance: RuleProvenance` lands on `Rule` and the server
 * serves it. They are absent rather than rendered empty: a pill reading
 * "Conflict · 0" asserts there are no conflicts, which is not something this
 * client knows — and inventing the tag client-side from `origin` would be a
 * derived verdict wearing the server's clothes.
 *
 * CONTRACT GAP: `GET /api/rules` takes no query parameters, so the filtering is
 * client-side over the full list the server already returned, and the counts
 * are the size of each partition — not a server-owned tally.
 */
export function RuleFilters({
  value,
  counts,
  total,
  onChange,
}: {
  value: RuleFilterKey;
  counts: RuleCounts;
  total: number;
  onChange: (key: RuleFilterKey) => void;
}) {
  const n: Record<RuleFilterKey, number> = { ...counts, all: total };

  return (
    <ToggleGroup
      aria-label="Filter rules by status"
      value={[value]}
      onValueChange={(next) => {
        const [key] = next;
        // Base UI clears the value when the pressed pill is pressed again. An
        // empty filter set would render an empty book, so the current filter
        // stands until a different one is chosen.
        if (key !== undefined && isFilterKey(key)) onChange(key);
      }}
    >
      {KEYS.map((key) => (
        <Toggle key={key} value={key}>
          {LABELS[key]} · {n[key]}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

function isFilterKey(value: string): value is RuleFilterKey {
  return (KEYS as readonly string[]).includes(value);
}
