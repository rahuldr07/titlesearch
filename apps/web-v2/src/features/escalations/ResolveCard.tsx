import { useState } from "react";
import type { Rule } from "@titlepipe/contract";
import { useResolveCluster, type RuleChoice } from "./queries";
import { ApiError } from "../../shared/api";
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
 */
export function ResolveCard({ ids, rules, onResolved }: ResolveCardProps) {
  const [ruling, setRuling] = useState("");
  const [mode, setMode] = useState("cite");
  const [ruleId, setRuleId] = useState("");
  const [draft, setDraft] = useState("");
  const resolve = useResolveCluster();

  const citable = rules.filter((rule) => rule.status === "live");
  const hasRule = mode === "cite" ? ruleId !== "" : draft.trim() !== "";
  const ready = ruling.trim() !== "" && hasRule;

  const label = ready
    ? "Resolve — write this rule in"
    : mode === "cite"
      ? "Resolve — held until a rule is cited"
      : "Resolve — held until the rule is drafted";

  return (
    <div className="flex flex-col gap-5 rounded-6 border border-line-strong bg-surface-panel p-8">
      <Eyebrow variant="section">
        The rule — one sentence, your words. This is what the screen is for; the
        per-order answer is incidental.
      </Eyebrow>

      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">The ruling for these orders</Eyebrow>
        <TextArea
          data-testid="ruling-input"
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

      {mode === "cite" ? (
        <label className="flex flex-col gap-2">
          <Eyebrow variant="field">Which rule</Eyebrow>
          <select
            data-testid="cite-select"
            value={ruleId}
            onChange={(event) => setRuleId(event.target.value)}
            className="rounded-5 border border-line-strong bg-surface-panel px-5 py-3 text-base text-ink-primary"
          >
            <option value="">— cite a live rule —</option>
            {citable.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.code} — {rule.text.slice(0, 70)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-2">
          <Eyebrow variant="field">The new rule, in one sentence</Eyebrow>
          <TextArea
            data-testid="draft-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
      )}

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
    </div>
  );
}
