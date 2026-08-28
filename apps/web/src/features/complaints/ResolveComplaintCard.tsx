import { useState } from "react";
import type { Rule } from "@titlepipe/contract";
import {
  Button,
  Checkbox,
  ComboBox,
  Label,
  Option,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from "../../components/ui";
import { RuleEffect } from "../../entities/rule/RuleEffect";
import { resolveHold, type RuleMode } from "./complaintHold";

/**
 * THE RESOLUTION, AND IT IS REFUSED WITHOUT A RULE.
 *
 * `endpoints.ts:548-556`: "the complaint loop terminates in a rule (principle
 * 3: escalations, reconciliation, AND complaints all produce a rulebook entry;
 * PRD §12: resolution = fix + rule + free golden-case offer). REFUSED without a
 * rule, exactly like escalation resolution."
 *
 * The refusal is carried in three places, exactly as `escalations/ResolveCard`
 * carries its own: the SERVER refuses (handlers.ts:1057, 422 from the schema)
 * and is the only enforcement; the request TYPE has no arm without a rule, so
 * the wrong call does not compile (`useComplaints.ts`); and this button states
 * the hold in words while the rule is missing, because a control that is merely
 * dead teaches nobody why. The mode radio has TWO members because the union has
 * two arms — a "resolve without a rule" escape is unrepresentable, not disabled.
 *
 * ══ ONLY LIVE RULES ARE CITABLE ════════════════════════════════════════════
 *
 * A `pending` rule cannot affect the pipeline (`INVARIANTS:38`), so citing one
 * would close a client's defect with something that does nothing; `retired` is
 * out for the mirror reason. Filtered on the SERVER's `status` field — never
 * inferred from origin or confirmer.
 *
 * ══ THE GOLDEN OFFER IS AN OFFER ═══════════════════════════════════════════
 *
 * `endpoints.ts:555`: "not every one earns it." So it is an unchecked box that
 * sends `true` only when ticked, never a default, and it does NOT gate the
 * submit — a resolution held for want of a test case would be this screen
 * inventing a fourth requirement the contract does not have.
 */
export function ResolveComplaintCard({
  rules,
  pending,
  onResolve,
}: {
  readonly rules: readonly Rule[];
  readonly pending: boolean;
  readonly onResolve: (
    resolution: string,
    rule: { rule_id: string } | { draft: { text: string } },
    goldenOffer: boolean,
  ) => void;
}) {
  const [resolution, setResolution] = useState("");
  const [mode, setMode] = useState<RuleMode>("cite");
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [golden, setGolden] = useState(false);

  const citable = rules.filter((rule) => rule.status === "live");
  const cited = citable.find((rule) => rule.id === ruleId);
  const held = resolveHold(resolution, mode, ruleId, draft);

  return (
    <div data-testid="resolve-complaint-card" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Label htmlFor="resolution-input">The fix, as it was made</Label>
        <Textarea
          id="resolution-input"
          data-testid="resolution-input"
          aria-label="The fix, as it was made"
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
        />
      </div>

      <RadioGroup
        aria-label="The rule this complaint terminates in"
        value={mode}
        onChange={(value) => setMode(value === "draft" ? "draft" : "cite")}
        className="flex flex-col gap-5"
      >
        <RadioGroupItem value="cite" data-testid="mode-cite">
          Cite a rule that already binds
        </RadioGroupItem>
        <RadioGroupItem value="draft" data-testid="mode-draft">
          Draft a new rule
        </RadioGroupItem>
      </RadioGroup>

      {mode === "cite" ? (
        <div className="flex flex-col gap-4" data-testid="cite-select">
          <ComboBox
            label="The rule this complaint resolves to"
            placeholder="Search the rulebook…"
            selectedKey={ruleId}
            onSelectionChange={(key) => setRuleId(key === null ? null : String(key))}
          >
            {citable.map((rule) => (
              <Option key={rule.id} id={rule.id}>
                {`${rule.code} — ${rule.text}`}
              </Option>
            ))}
          </ComboBox>
          {/* What citing it will DO. Read off the server's status, not hoped. */}
          {cited !== undefined && <RuleEffect code={cited.code} status={cited.status} />}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Label htmlFor="complaint-draft-input">The rule, in the words that will bind</Label>
          <Textarea
            id="complaint-draft-input"
            data-testid="draft-input"
            aria-label="The rule, in the words that will bind"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {/* Said BEFORE the draft is written. A reader who learns it from the
              receipt has already believed otherwise for the length of the form. */}
          <RuleEffect code="this draft" status="pending" />
        </div>
      )}

      <Checkbox isSelected={golden} onChange={setGolden} data-testid="golden-offer">
        Offer this as a permanent golden case
      </Checkbox>

      <Button
        data-testid="resolve-complaint-btn"
        variant="primary"
        disabledBecause={pending ? "Sending — the server has not answered yet." : held}
        onPress={() =>
          onResolve(
            resolution,
            mode === "cite" && ruleId !== null ? { rule_id: ruleId } : { draft: { text: draft } },
            golden,
          )
        }
      >
        {held === null ? "Close on this rule" : "Close — held without a rule"}
      </Button>
    </div>
  );
}
