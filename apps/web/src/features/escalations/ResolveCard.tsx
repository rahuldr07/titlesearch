import { useState } from "react";
import type { Rule } from "@titlepipe/contract";
import { Button, ComboBox, Option, Label, RadioGroup, RadioGroupItem, Textarea } from "../../components/ui";
import { RuleEffect } from "../../entities/rule/RuleEffect";
import { holdReason, type ResolutionMode } from "./holdReason";

/**
 * THE RESOLUTION, AND IT IS REFUSED WITHOUT A RULE.
 *
 * `endpoints.ts:233-236` / `INVARIANTS:36-37`, `§0.5 MANDATORY`: "escalation
 * resolution is REFUSED without a rule. A ruling alone is not a resolution."
 * THE DESIGN NEVER SAYS THIS. Design §Screens 10 draws "determination buttons"
 * and a "settled banner" and mentions no rule at all, so a faithful
 * transcription of the drawing would ship a screen that settles clusters the
 * server refuses to settle. The contract wins.
 *
 * The refusal is carried in three places, on purpose:
 *   - the SERVER refuses (handlers.ts:1474, 422) — the only enforcement;
 *   - the request TYPE has no arm without a rule, so the wrong call does not
 *     compile (`useEscalations.ts`);
 *   - this button states the hold in words while the rule is missing, because
 *     a control that is merely dead teaches nobody why.
 *
 * ══ EXACTLY TWO PATHS, AND NO THIRD ════════════════════════════════════════
 *
 * `INVARIANTS:37`. The mode radio has two members because the contract union
 * has two arms; a "resolve without a rule" escape is not disabled here, it is
 * unrepresentable.
 *
 * ══ ONLY LIVE RULES ARE CITABLE ════════════════════════════════════════════
 *
 * A `pending` rule cannot affect the pipeline (`INVARIANTS:38`), so citing one
 * would be resolving a cluster with something that does nothing. `retired` is
 * out for the mirror reason. Filtered by the SERVER's `status` field — never
 * inferred from origin or confirmer.
 */
export type ResolveCardProps = {
  readonly rules: readonly Rule[];
  readonly pending: boolean;
  readonly onResolve: (ruling: string, rule: { rule_id: string } | { draft: { text: string } }) => void;
};

export function ResolveCard({ rules, pending, onResolve }: ResolveCardProps) {
  const [ruling, setRuling] = useState("");
  const [mode, setMode] = useState<ResolutionMode>("cite");
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const citable = rules.filter((rule) => rule.status === "live");
  const cited = citable.find((rule) => rule.id === ruleId);
  const held = holdReason(ruling, mode, ruleId, draft);

  return (
    <div data-testid="resolve-card" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Label htmlFor="ruling-input">The ruling</Label>
        <Textarea
          id="ruling-input"
          data-testid="ruling-input"
          aria-label="The ruling"
          value={ruling}
          onChange={(event) => setRuling(event.target.value)}
        />
      </div>

      <RadioGroup
        aria-label="How this cluster is ruled"
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
            label="The rule this cluster resolves to"
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
          <Label htmlFor="draft-input">The rule, in the words that will bind</Label>
          <Textarea
            id="draft-input"
            data-testid="draft-input"
            aria-label="The rule, in the words that will bind"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {/*
           * Said BEFORE the draft is written, not after. `INVARIANTS:38` is
           * about what a drafted rule can do to the pipeline, and a senior who
           * learns that only from the receipt has already believed otherwise
           * for the length of the form.
           */}
          <RuleEffect code="this draft" status="pending" />
        </div>
      )}

      <Button
        data-testid="resolve-btn"
        variant="primary"
        disabledBecause={pending ? "Sending — the server has not answered yet." : held}
        onPress={() =>
          onResolve(ruling, mode === "cite" && ruleId !== null ? { rule_id: ruleId } : { draft: { text: draft } })
        }
      >
        {held === null ? "Resolve the cluster" : "Resolve — held without a rule"}
      </Button>
    </div>
  );
}
