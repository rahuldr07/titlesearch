import { useMutation } from "@tanstack/react-query";
import { Ack, CreateBugRequest } from "@titlepipe/contract";
import { useState } from "react";
import { api } from "../../api";
import { RequiredComment } from "../../shared/ui/RequiredComment";

/**
 * The broken-input channel. `POST /api/bugs`.
 *
 * BUGS ARE NOT CORRECTIONS, and this is the one distinction the component
 * exists to hold. CONTEXT §6 keeps them in two tables with two audiences:
 *
 *   a CORRECTION is a reviewer fixing a field value — it goes to the rulebook
 *   a BUG is a broken INPUT or a defective derived field — it goes to DEVELOPERS
 *
 * Filing a bug where a correction belongs buries a data defect in an engineering
 * queue; filing a correction where a bug belongs asks a senior to hand-fix the
 * same broken function on every order it touches. The dashboard's "one broken
 * function, not two defects" drill-down (orphan O17) is downstream of getting
 * this split right.
 *
 * Open to every role in the pipeline, including the ones that may not decide
 * fields — anyone who can see a broken input should be able to say so.
 */
export function BugChannel({
  orderId,
  fieldId,
}: {
  orderId: string;
  fieldId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [filed, setFiled] = useState(false);

  const file = useMutation({
    mutationFn: async (description: string) =>
      api(Ack, "/api/bugs", {
        method: "POST",
        body: JSON.stringify(
          CreateBugRequest.parse({
            order_id: orderId,
            field_id: fieldId,
            description,
          }),
        ),
      }),
    onSuccess: () => {
      setFiled(true);
      setOpen(false);
    },
  });

  if (filed) {
    return (
      <div
        data-testid="bug-filed"
        className="mt-3 rounded-md border border-state-settled-border bg-state-settled-surface px-3 py-2 text-sm text-state-settled"
      >
        Filed to engineering. This is a broken input, not a field correction —
        it will not appear in the rules inbox.
      </div>
    );
  }

  return (
    <div className="mt-3">
      {open ? (
        <div className="rounded-md border border-line-strong bg-surface-panel p-3">
          <RequiredComment
            label="What is broken about the input? — required"
            placeholder="e.g. the tax card for this parcel is a duplicate of the previous order's"
            nudge="A bug report needs a description — what is broken, and where?"
            submitLabel="Send to engineering"
            testId="bug-description"
            submitTestId="bug-submit"
            nudgeTestId="bug-nudge"
            autoFocus
            multiline
            disabled={file.isPending}
            onSubmit={(text) => file.mutate(text)}
          />
          {file.isError ? (
            <div className="mt-2 text-sm text-state-halt-ink">
              server: {file.error.message}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          data-testid="act-bug"
          onClick={() => setOpen(true)}
          className="rounded-md border border-line-strong bg-surface-panel px-3 py-2 text-sm font-semibold text-ink-secondary"
        >
          Report pipeline bug
        </button>
      )}
    </div>
  );
}
