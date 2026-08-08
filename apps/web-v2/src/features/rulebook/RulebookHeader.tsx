import { Button } from "../../shared/ui/Button";
import { CensusTile } from "../../shared/ui/CensusTile";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";

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
 * THE THREE TALLIES ARE A CENSUS, NOT A SCORECARD (§4.5). Each is "how many
 * rules are sitting in this state right now" — never a confirmation rate, never
 * a backlog age, never pending-as-a-percentage-of-live. `CensusTile` is what
 * keeps that true after this file stops being read: the derived figure someone
 * will eventually ask for has no prop to arrive through.
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
    <ScreenHeading
      eyebrow="Admin · Rulebook"
      /*
        NO `<em>` HERE, DELIBERATELY. RULE: the signature italic takes a closing
        PHRASE — "to you", "overrides" — not the head noun of a two-word label.
        FAILURE PREVENTED: "Extraction <em>rules</em>" italicises the word that
        carries no more of the argument than the one before it, and an emphasis
        with no reason behind it teaches a reader that the italic means nothing,
        which spends the device everywhere it is actually load-bearing.
      */
      title="Extraction rules"
      lede={
        <p>
          A rule is inert until an engineer or admin confirms it. Writing a rule and
          enabling it are separate acts. Nothing is ever deleted — rules retire.
        </p>
      }
      actions={
        <>
          <CensusTile size="strip" tone="settled" value={counts.live} caption="Live" />
          <CensusTile
            size="strip"
            tone="attend"
            value={counts.pending}
            caption="Pending"
          />
          <CensusTile
            size="strip"
            tone="muted"
            value={counts.retired}
            caption="Retired"
          />
          <Button size="md" data-testid="new-rule" onClick={onNewRule}>
            ＋ New rule
          </Button>
        </>
      }
    />
  );
}
