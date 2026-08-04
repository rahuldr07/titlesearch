import type { Rule } from "@titlepipe/contract";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextArea } from "../../shared/ui/TextField";

/**
 * THE TWO RESOLUTION PATHS, AND NO THIRD — cite a live rule, or draft one.
 *
 * RULE: only LIVE rules are citable (`ResolveCard`'s own note). FAILURE
 * PREVENTED: citing a pending rule resolves an escalation into something that
 * cannot act, and the reviewer stops escalating while nothing downstream has
 * changed. The filter is applied here, where the options are built, so there is
 * no list of ineligible rules to accidentally render.
 *
 * A NATIVE `<select>`, DELIBERATELY — the one control in the app that is not
 * the shared `Select`. Playwright's `selectOption` drives native selects only,
 * and `escalations.spec` #2 ("citing an existing rule resolves the cluster" —
 * the assertion that the mandatory refusal can actually be SATISFIED) is
 * written against it. A styled listbox would leave the refusal provable and its
 * release unprovable. Its geometry matches `SelectTrigger`'s (7px radius, 10/8px
 * padding) so it is at least not also a different shape from every other
 * control on the form.
 *
 * CONTRACT GAP, unchanged by that: a native `<option>` cannot render the
 * citation the way the design draws it, so `{code} — {text}` is cut at 70
 * characters rather than wrapping.
 *
 * BOTH FIELDS CARRY A WORKED EXAMPLE. Every other form in this app has a
 * design-sourced placeholder; this screen — whose entire product claim is
 * "write the rule, one sentence" — shipped two empty boxes under uppercase
 * instructions.
 */
export function RuleChoiceFields({
  mode,
  rules,
  ruleId,
  onRuleId,
  draft,
  onDraft,
}: {
  mode: string;
  rules: readonly Rule[];
  ruleId: string;
  onRuleId: (id: string) => void;
  draft: string;
  onDraft: (text: string) => void;
}) {
  if (mode !== "cite") {
    return (
      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">The new rule, in one sentence</Eyebrow>
        <TextArea
          data-testid="draft-input"
          placeholder="e.g. An HOA lien reports regardless of age unless it is cancelled of record."
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-2">
      <Eyebrow variant="field">Which rule</Eyebrow>
      <select
        data-testid="cite-select"
        value={ruleId}
        onChange={(event) => onRuleId(event.target.value)}
        className="rounded-6 border border-line-strong bg-surface-panel px-5 py-4 text-base text-ink-primary"
      >
        <option value="">— cite a live rule —</option>
        {rules
          .filter((rule) => rule.status === "live")
          .map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.code} — {rule.text.slice(0, 70)}
            </option>
          ))}
      </select>
    </label>
  );
}
