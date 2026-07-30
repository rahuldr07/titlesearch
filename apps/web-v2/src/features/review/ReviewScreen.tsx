import { useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Field } from "@titlepipe/contract";
import {
  orderFieldsQuery,
  orderSignoffQuery,
  useConfirmField,
  useCorrectField,
  useEscalateField,
  useExcludeField,
  usePassOrder,
} from "./queries";
import { readingsOf } from "./fieldLabel";
import { EvidenceColumn } from "./EvidenceColumn";
import { FieldsColumn } from "./FieldsColumn";
import { ReviewHeader } from "./ReviewHeader";
import { useReviewEditor } from "./useReviewEditor";
import { useReviewKeys } from "./useReviewKeys";
import { useReviewSelection } from "./useReviewSelection";
import { ApiError } from "../../shared/api";
import { Screen } from "../../shared/ui/Screen";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";

/**
 * The review workstation — document, decision, draft sheet.
 *
 * J AND K WALK ONLY SERVER-QUEUED FIELDS (`review.spec` #9). The queue is the
 * server's judgment about what needs a person; walking past it by keyboard is
 * how re-deciding settled fields becomes a habit.
 *
 * SELECTION IS URL-OWNED, so `?field=` is a first-class deep link and a
 * complaint or an escalation can point at the exact field in context.
 */
export function ReviewScreen() {
  const { orderId } = useParams({ from: "/orders/$orderId/review" });
  const { field: fieldParam } = useSearch({ from: "/orders/$orderId/review" });
  const { data, isPending, isError } = useQuery(orderFieldsQuery(orderId));
  // Supplementary to the fields above — a pending or failed fetch just means
  // no disclosure cards render yet, never a false claim about what the
  // abstractor answered.
  const signoff = useQuery(orderSignoffQuery(orderId));

  const confirm = useConfirmField(orderId);
  const correct = useCorrectField(orderId);
  const escalate = useEscalateField(orderId);
  const exclude = useExcludeField(orderId);
  const pass = usePassOrder(orderId);

  const fields: Field[] = data?.fields ?? [];
  const { queued, selected, select, step, advance } = useReviewSelection(
    orderId,
    fields,
    fieldParam,
  );

  const { mode, setMode, pinned, setPinned, seed, blankNote, setBlankNote, reselect, adopt, openCorrect } =
    useReviewEditor(select);

  const submitConfirm = () => {
    if (selected === null) return;
    confirm.mutate({ fieldId: selected.id, value: selected.value }, { onSuccess: advance });
  };

  useReviewKeys(
    {
      next: () => step(1),
      previous: () => step(-1),
      // `c` NEVER ACCEPTS A BLANK (`ux.spec` O9). Confirm moved off ⏎ onto `c`
      // in the design remap; the rule moved with it. A missing field demands an
      // explicit click — the only keyboard-layer defence against bulk-accepting
      // absences by holding the confirm key down. The button (`act-confirm`)
      // calls `submitConfirm` directly, so the explicit click still accepts N/A.
      confirm: () => (selected?.value == null ? setBlankNote(true) : submitConfirm()),
      // `e` OPENS the correction field; it never commits (that is Enter, inside
      // the field). Escalate has no hotkey — it is `act-escalate`, a button.
      correct: openCorrect,
      exclude: () => setMode("exclude"),
      pass: () => setMode("pass"),
    },
    mode === "idle" && selected !== null,
  );

  if (isError) return <ScreenMessage tone="halt" measure="1340">Order fields unavailable.</ScreenMessage>;
  if (isPending) return <ScreenMessage measure="1340">Loading the order…</ScreenMessage>;
  if (selected === null) return <ScreenMessage measure="1340">No fields on this order.</ScreenMessage>;
  const editorSeed = seed ?? selected.value ?? readingsOf(selected)[0]?.value ?? "";

  return (
    <Screen placement="bleed">
      <div className="flex h-full flex-col gap-8">
        <ReviewHeader fields={fields} queued={queued.length} />

        {/* TWO columns. The document is the work; the decision and the sheet
            stack beside it because they are one conversation. A third column
            starved both and pushed the sheet's values out of their rows. */}
        <div className="grid min-h-0 items-start gap-6 xl:grid-cols-2">
          <EvidenceColumn orderId={orderId} field={selected} pinnedReading={pinned?.reading ?? null} />

          <FieldsColumn
            fields={fields}
            signoffLines={signoff.data?.lines ?? []}
            selected={selected}
            pinned={pinned}
            mode={mode}
            seed={editorSeed}
            passPending={pass.isPending}
            serverNote={confirm.error instanceof ApiError ? confirm.error.message : null}
            blankNote={blankNote}
            onPin={setPinned}
            onAdopt={adopt}
            onConfirm={submitConfirm}
            onCorrect={openCorrect}
            onMode={setMode}
            onCorrectSubmit={(value, reason) =>
              correct.mutate({ fieldId: selected.id, value, reason }, { onSuccess: advance })
            }
            onEscalateSubmit={(question) =>
              escalate.mutate({ fieldId: selected.id, question }, { onSuccess: advance })
            }
            onExcludeSubmit={(reason) =>
              exclude.mutate({ fieldId: selected.id, reason }, { onSuccess: advance })
            }
            onPassSubmit={(reason) => pass.mutate(reason, { onSuccess: () => setMode("idle") })}
            onSelect={reselect}
          />
        </div>
      </div>
    </Screen>
  );
}
