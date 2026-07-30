import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextArea, TextField } from "../../shared/ui/TextField";
import { PendingBanner } from "./PendingBanner";
import { TagChoice, type AuthorableTag } from "./TagChoice";

const NO_ENDPOINT =
  "Nothing was saved. There is no create-rule endpoint in the contract — POST /api/rules/{id}/confirm is the only rule mutation that exists, and this client does not invent routes.";

/**
 * WRITING A RULE, WHICH IS NOT THE SAME AS ENABLING ONE.
 *
 * The amber banner is the first thing in the form and says what saving does:
 * it records the rule and changes nothing. That has to be stated before the
 * fields, not after the button, because an author who believes they are
 * switching extraction on will write differently from one who knows a second
 * person has to agree.
 *
 * CITATION IS THE REQUIRED FIELD AND IS DRAWN AS SUCH — halt border, halt
 * label. The other three describe what the author wants; the citation is the
 * only one that says why anyone should believe them. A rule with no authority
 * behind it cannot be recorded (principle 6).
 *
 * SAVING REFUSES AND NAMES WHAT IS MISSING, in one message listing every empty
 * required field. Marking each field individually makes the author fix them one
 * at a time; one sentence lets them fix all four and press once.
 *
 * THAT MESSAGE IS NOT A `RefusalNudge`, and the reason is the same sentence:
 * the nudge wires itself to ONE control's `aria-describedby`, and a refusal
 * naming four fields pointed at one input would describe the citation box with
 * a complaint about the scope box. It keeps `role="alert"` and its own testid,
 * and takes only `Card`'s halt tone so it is drawn as the two restricted-act
 * refusals in the detail pane are.
 */
export function NewRuleForm({ onCancel }: { onCancel: () => void }) {
  const [scope, setScope] = useState("");
  const [condition, setCondition] = useState("");
  const [outcome, setOutcome] = useState("");
  const [citation, setCitation] = useState("");
  const [tag, setTag] = useState<AuthorableTag>("RULED");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const missing = [
      ["Scope", scope],
      ["Condition", condition],
      ["Outcome", outcome],
      ["Citation", citation],
    ]
      .filter(([, value]) => (value ?? "").trim().length === 0)
      .map(([label]) => label);

    setError(
      missing.length > 0
        ? `Nothing was saved. Required and still empty: ${missing.join(", ")}.`
        : NO_ENDPOINT,
    );
  };

  return (
    <section
      data-testid="new-rule-form"
      className="overflow-hidden rounded-10 border-(length:--stroke-emphasis) border-state-attend border-dashed bg-surface-panel"
    >
      <PendingBanner />

      <div className="flex flex-col gap-3 p-8">
        <Eyebrow variant="field" as="label" htmlFor="rule-scope">
          Scope
        </Eyebrow>
        <TextField
          id="rule-scope"
          size="sm"
          value={scope}
          placeholder="States, counties, clients, sections, fields"
          onChange={(event) => setScope(event.target.value)}
        />

        <Eyebrow variant="field" as="label" htmlFor="rule-condition" className="mt-4">
          Condition — what must be true in the document
        </Eyebrow>
        <TextArea
          id="rule-condition"
          size="sm"
          rows={2}
          value={condition}
          placeholder="e.g. Granting clause contains 'undivided … interest'"
          onChange={(event) => setCondition(event.target.value)}
        />

        <Eyebrow variant="field" as="label" htmlFor="rule-outcome" className="mt-4">
          Outcome — what the report should then say or do
        </Eyebrow>
        <TextArea
          id="rule-outcome"
          size="sm"
          rows={2}
          value={outcome}
          placeholder="e.g. Set Interest Conveyed to the stated fraction"
          onChange={(event) => setOutcome(event.target.value)}
        />

        <Eyebrow variant="field" as="label" htmlFor="rule-citation" tone="halt" className="mt-4">
          Citation — required · the ruling or source
        </Eyebrow>
        <TextArea
          id="rule-citation"
          size="sm"
          rows={2}
          tone="halt"
          emphasis
          value={citation}
          placeholder="A rule with no authority behind it cannot be recorded"
          onChange={(event) => setCitation(event.target.value)}
        />

        <TagChoice value={tag} onChange={setTag} />

        {error === null ? null : (
          <Card
            size="nested"
            tone="halt"
            role="alert"
            data-testid="new-rule-error"
            className="px-6 py-5 text-sm leading-body text-state-halt-ink"
          >
            {error}
          </Card>
        )}

        <div className="mt-2 flex gap-4">
          <Button fill="outlined" className="flex-1" data-testid="save-pending" onClick={save}>
            Save as PENDING
          </Button>
          <Button fill="outlined" tone="neutral" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </section>
  );
}
