import { Checkbox, Input, Label, Textarea } from "../../components/ui";
import { RuleEffect } from "../../entities/rule/RuleEffect";

/**
 * THE GENERAL RULE, OFFERED — NEVER PRE-SELECTED.
 *
 * `endpoints.ts:346-348`, verbatim: "A general rule may be offered by the
 * senior (NEVER PRE-SELECTED BY THE UI) and lands PENDING." Both halves are
 * load-bearing and both are here:
 *
 *   - the box starts UNCHECKED and nothing checks it — not a heuristic on the
 *     path, not a memory of the last ruling. A pre-ticked offer is the UI
 *     proposing a rule the senior did not, and `general_rule_draft` is simply
 *     absent from the request until they say so (`useReconciliation.ts`);
 *   - the PENDING consequence is stated BEFORE the words are typed, not after.
 *     `INVARIANTS:38` — a drafted rule "lands PENDING and renders visibly
 *     inert; it cannot affect the pipeline until an engineer confirms" — and a
 *     senior who learns that from the receipt has already believed otherwise
 *     for the length of the form.
 *
 * The offer never gates the ruling. A ruling stands on its citation; requiring
 * a general rule would be this screen inventing a second mandatory field the
 * contract does not have.
 */
export function GeneralRuleOffer({
  offered,
  onOffered,
  draft,
  onDraft,
  onScope,
}: {
  readonly offered: boolean;
  readonly onOffered: (value: boolean) => void;
  readonly draft: string;
  readonly onDraft: (value: string) => void;
  readonly onScope: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Checkbox isSelected={offered} onChange={onOffered} data-testid="offer-general-rule">
        Offer a general rule from this ruling
      </Checkbox>

      {offered && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <Label htmlFor="general-rule-draft">The rule, in the words that will bind</Label>
            <Textarea
              id="general-rule-draft"
              data-testid="general-rule-draft"
              aria-label="The rule, in the words that will bind"
              value={draft}
              onChange={(event) => onDraft(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-4">
            <Label htmlFor="general-rule-scope">
              Where it binds — optional, and empty means everywhere
            </Label>
            {/* Rule 3: a jurisdiction scope is an identifier, so it is mono. */}
            <Input
              id="general-rule-scope"
              data-testid="general-rule-scope"
              data
              aria-label="Where it binds"
              onChange={(event) => onScope(event.target.value)}
            />
          </div>

          <RuleEffect code="this draft" status="pending" />
        </div>
      )}
    </div>
  );
}
