import { useState } from "react";
import type { Rule } from "@titlepipe/contract";
import { useResolveCluster, type RuleChoice } from "./queries";
import { RuleChoiceFields } from "./RuleChoiceFields";
import { ApiError } from "../../shared/api";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextArea } from "../../shared/ui/TextField";
import { Button } from "../../shared/ui/Button";
import { Radio, RadioGroup } from "../../shared/ui/RadioGroup";

interface ResolveCardProps {
  ids: readonly string[];
  rules: readonly Rule[];
  /**
   * Pins the rail to this cluster once it clears. Without it the selection
   * falls through to the next unanswered wall and the person who just wrote a
   * rule never sees what it did — which is the only feedback this screen gives.
   */
  onResolved: () => void;
}

/**
 * THE RULE IS THE RESOLUTION (ruling D1). Two paths and no third: cite a rule
 * that already exists, or draft one — which lands PENDING and cannot touch the
 * pipeline until an engineer confirms it. The design's looser flow, where a
 * ruling returns to the reviewer and the rule is offered afterwards as an
 * optional link, is overridden: a rule you can skip is a rule nobody writes,
 * and then the same question arrives next week wearing a different order id.
 *
 * THE BUTTON IS DISABLED AND SAYS WHY. Refusing on click would be a smaller
 * change; naming what is missing is what makes it a rule rather than a
 * malfunction.
 *
 * ONLY LIVE RULES ARE CITABLE — citing a pending rule would resolve an
 * escalation into something that cannot act. CONTRACT GAP: the server accepts
 * any existing rule id here, so this refusal currently lives only in the client.
 *
 * THE SERVER'S REJECTION STAYS A HAND-SPELLED LINE, not a `RefusalNudge`. That
 * component IS the client's own §4.6 refusal and stamps `data-testid="nudge"`
 * on what it draws; a 500 from the resolve endpoint is a different claim about
 * a different actor, and filing it under the same testid would let a screen
 * that never refused anything satisfy a refusal assertion.
 */
export function ResolveCard({ ids, rules, onResolved }: ResolveCardProps) {
  const [ruling, setRuling] = useState("");
  const [mode, setMode] = useState("cite");
  const [ruleId, setRuleId] = useState("");
  const [draft, setDraft] = useState("");
  const resolve = useResolveCluster();

  const hasRule = mode === "cite" ? ruleId !== "" : draft.trim() !== "";
  const ready = ruling.trim() !== "" && hasRule;

  const label = ready
    ? "Resolve — write this rule in"
    : mode === "cite"
      ? "Resolve — held until a rule is cited"
      : "Resolve — held until the rule is drafted";

  return (
    <Card className="flex flex-col gap-5 p-8">
      <div className="flex flex-col gap-2">
        {/* Violet and SHORT, as the archive sets it. Carrying the whole
            sentence, this was twenty words of letterspaced uppercase ruling one
            unbroken line across the screen — the register the design reserves
            for labels of five words or fewer, spent on a paragraph. */}
        <Eyebrow variant="section" tone="action">
          The rule — one sentence, your words
        </Eyebrow>
        <p className="text-xs leading-body text-ink-muted">
          This is what the screen is for; the per-order answer is incidental.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">The ruling for these orders</Eyebrow>
        {/* A WORKED EXAMPLE, as the design writes it. Every other form in this
            app carries a design-sourced placeholder; this one — the screen whose
            entire claim is "write the rule, one sentence" — shipped an empty box
            under an uppercase instruction. */}
        <TextArea
          data-testid="ruling-input"
          placeholder="One sentence — the rule as you'd say it out loud."
          value={ruling}
          onChange={(event) => setRuling(event.target.value)}
        />
      </label>

      <RadioGroup aria-label="How this becomes a rule" value={mode} onValueChange={(v) => setMode(String(v))}>
        <Radio value="cite" testId="mode-cite">
          This is an existing rule people are not finding
        </Radio>
        <Radio value="draft" testId="mode-draft">
          This is a new rule — draft it, lands PENDING
        </Radio>
      </RadioGroup>

      <RuleChoiceFields
        mode={mode}
        rules={rules}
        ruleId={ruleId}
        onRuleId={setRuleId}
        draft={draft}
        onDraft={setDraft}
      />

      <div className="flex flex-wrap items-center gap-5">
        <Button
          data-testid="resolve-btn"
          disabled={!ready || resolve.isPending}
          onClick={() => {
            const rule: RuleChoice =
              mode === "cite" ? { rule_id: ruleId } : { draft: { text: draft.trim() } };
            resolve.mutate({ ids, ruling: ruling.trim(), rule }, { onSuccess: onResolved });
          }}
        >
          {label}
        </Button>
        <span className="text-xs text-ink-muted">
          no category, no priority, no assignee — just the rule
        </span>
      </div>

      {resolve.error instanceof ApiError ? (
        <p role="alert" className="text-xs font-semibold text-state-halt-ink">
          server: {resolve.error.message}
        </p>
      ) : null}
    </Card>
  );
}
