import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";
import { ScreenTitle } from "../../app/ScreenTitle";

export interface RuleCounts {
  live: number;
  pending: number;
  retired: number;
}

/**
 * The rulebook's masthead: what the book is, and how much of it is inert.
 *
 * The standing sentence — "A rule is inert until an engineer or admin confirms
 * it" — is load-bearing copy, not a subtitle. The rulebook is the one screen
 * where writing something and it taking effect are different acts by different
 * people, and a reader who misses that will follow a PENDING rule as policy.
 *
 * PENDING IS COUNTED AS LOUDLY AS LIVE, in attend-amber, next to the live
 * tally. A backlog of unconfirmed rules is the thing this screen exists to make
 * uncomfortable; putting it behind a filter would make it comfortable.
 *
 * CONTRACT GAP: the design's third stat is Conflict, which needs a provenance
 * tag (RULED / DERIVED / OPEN / CONFLICT) per rule. `RuleProvenance` exists in
 * the contract's enums but `Rule` does not carry it, so a conflict tally cannot
 * be sourced. Retired — a status the contract does carry — stands in its place
 * rather than a number nobody can cite.
 */
export function RulebookHeader({
  counts,
  onNewRule,
}: {
  counts: RuleCounts;
  onNewRule: () => void;
}) {
  return (
    <header className="flex flex-wrap items-end gap-8">
      <div className="flex min-w-130 flex-1 flex-col gap-2">
        <ScreenTitle>Admin · Rulebook</ScreenTitle>
        <h1 className="text-3xl font-semibold text-ink-primary">Extraction rules</h1>
        <p className="max-w-3xl text-base leading-body text-ink-secondary">
          A rule is inert until an engineer or admin confirms it. Writing a rule
          and enabling it are separate acts. Nothing is ever deleted — rules
          retire.
        </p>
      </div>

      <div className="flex items-center gap-7">
        <Stat value={counts.live} label="Live" tone="text-state-settled" />
        <Stat value={counts.pending} label="Pending" tone="text-state-attend" />
        <Stat value={counts.retired} label="Retired" tone="text-ink-muted" />
        <Button size="md" data-testid="new-rule" onClick={onNewRule}>
          ＋ New rule
        </Button>
      </div>
    </header>
  );
}

/**
 * A tally. Mono because the numerals have to line up when they change width,
 * and the label is the `stat` eyebrow — unweighted on purpose, so the number
 * carries the emphasis and the caption stays a caption.
 */
function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="text-right">
      <div className={cn("font-mono text-xl font-semibold", tone)}>{value}</div>
      <Eyebrow variant="stat">{label}</Eyebrow>
    </div>
  );
}
