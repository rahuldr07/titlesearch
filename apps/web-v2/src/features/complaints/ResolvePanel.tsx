import { useState } from "react";
import { useResolveComplaint } from "./queries";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";
import { Button } from "../../shared/ui/Button";
import { Checkbox } from "../../shared/ui/Checkbox";

/**
 * A COMPLAINT RESOLUTION IS REFUSED WITHOUT A RULE
 * (`delivery-complaints.spec` #5). Filling in what was fixed is not enough,
 * and the button stays disabled to say so: re-issuing v2 corrects one report
 * and changes nothing about the next one. The rule is what stops the same
 * complaint arriving again next month.
 *
 * A DRAFTED RULE LANDS PENDING and cannot affect the pipeline until an
 * engineer confirms it. That is what makes drafting one cheap — a junk draft
 * is inert, so the cost of writing one is near zero, while the cost of
 * resolving without one compounds silently.
 *
 * Offering the case to the golden set is optional and separate: a complaint is
 * evidence of a real-world miss, which is exactly what a seed set wants.
 */
export function ResolvePanel({ complaintId }: { complaintId: string }) {
  const [resolution, setResolution] = useState("");
  const [draftMode, setDraftMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [golden, setGolden] = useState(false);
  const resolve = useResolveComplaint();

  const hasRule = draftMode && draft.trim() !== "";
  const ready = resolution.trim() !== "" && hasRule;

  return (
    <div className="flex flex-col gap-4 border-t border-line-subtle bg-surface-sunken px-8 py-6">
      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">What was done about it?</Eyebrow>
        <TextField
          data-testid={`cmp-resolution-${complaintId}`}
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
        />
      </label>

      <label className="flex items-center gap-4">
        <Checkbox
          id={`cmp-mode-draft-${complaintId}`}
          data-testid={`cmp-mode-draft-${complaintId}`}
          checked={draftMode}
          onCheckedChange={setDraftMode}
        />
        <span className="text-base">Draft a rule so this cannot recur — lands PENDING</span>
      </label>

      {draftMode ? (
        <TextField
          data-testid={`cmp-draft-input-${complaintId}`}
          value={draft}
          placeholder="the rule, in one sentence"
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : null}

      <label className="flex items-center gap-4">
        <Checkbox
          id={`cmp-golden-offer-${complaintId}`}
          data-testid={`cmp-golden-offer-${complaintId}`}
          checked={golden}
          onCheckedChange={setGolden}
        />
        <span className="text-base">Offer this order as a golden case</span>
      </label>

      {!ready ? (
        <p className="text-xs font-semibold text-state-attend-ink">
          A fix alone is not a resolution — this needs a rule, or it happens again.
        </p>
      ) : null}

      <div>
        <Button
          size="sm"
          data-testid={`cmp-resolve-btn-${complaintId}`}
          disabled={!ready || resolve.isPending}
          onClick={() =>
            resolve.mutate({
              id: complaintId,
              resolution: resolution.trim(),
              rule: { draft: { text: draft.trim() } },
              golden_offer_accepted: golden,
            })
          }
        >
          Resolve with this rule
        </Button>
      </div>
    </div>
  );
}
