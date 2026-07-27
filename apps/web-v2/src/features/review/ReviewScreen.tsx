import { useState } from "react";
import { useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Field } from "@titlepipe/contract";
import {
  orderFieldsQuery,
  useConfirmField,
  useCorrectField,
  useEscalateField,
  usePassOrder,
} from "./queries";
import { readingsOf } from "./fieldLabel";
import { DecisionPanel, type Pinned } from "./DecisionPanel";
import { FieldList } from "./FieldList";
import { ReviewEditors, type ReviewMode } from "./ReviewEditors";
import { OrderRail } from "./OrderRail";
import { useReviewKeys } from "./useReviewKeys";
import { useReviewSelection } from "./useReviewSelection";
import { ApiError } from "../../shared/api";
import { ScreenTitle } from "../../app/ScreenTitle";

/**
 * The review workstation.
 *
 * FIELD NAVIGATION VISITS ONLY SERVER-QUEUED FIELDS (`review.spec` #9). J and K
 * walk `needs_review` and nothing else — a reviewer cannot walk into an
 * auto-confirmed field and start re-deciding it, because the queue IS the
 * server's judgment about what needs a person, and browsing past it is how
 * throughput pressure gets in.
 *
 * SELECTION IS URL-OWNED. `?field=` is a first-class deep link, so a complaint,
 * an escalation or a colleague's message can point at the exact field in
 * context and the destination is never asked to re-derive it.
 */
export function ReviewScreen() {
  const { orderId } = useParams({ from: "/orders/$orderId/review" });
  const { field: fieldParam } = useSearch({ from: "/orders/$orderId/review" });
  const { data, isPending, isError } = useQuery(orderFieldsQuery(orderId));
  const [mode, setMode] = useState<ReviewMode>("idle");
  const [pinned, setPinned] = useState<Pinned | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [blankNote, setBlankNote] = useState(false);

  const confirm = useConfirmField(orderId);
  const correct = useCorrectField(orderId);
  const escalate = useEscalateField(orderId);
  const pass = usePassOrder(orderId);

  const fields: Field[] = data?.fields ?? [];
  const { queued, selected, select, step, advance } = useReviewSelection(
    orderId,
    fields,
    fieldParam,
  );

  const reselect = (path: string) => {
    setMode("idle");
    setPinned(null);
    setBlankNote(false);
    select(path);
  };

  const submitConfirm = () => {
    if (selected === null) return;
    confirm.mutate({ fieldId: selected.id, value: selected.value }, { onSuccess: advance });
  };

  useReviewKeys(
    {
      next: () => step(1),
      previous: () => step(-1),
      // ⏎ NEVER ACCEPTS A BLANK (`ux.spec` #4). A missing field demands an
      // explicit click — the only keyboard-layer defence against bulk-accepting
      // absences by holding Enter down.
      confirm: () => (selected?.value == null ? setBlankNote(true) : submitConfirm()),
      correct: () => { setSeed(null); setMode("correct"); },
      escalate: () => setMode("escalate"),
      pass: () => setMode("pass"),
    },
    mode === "idle" && selected !== null,
  );

  if (isError) return <p className="text-base text-state-halt-ink">Order fields unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the order…</p>;
  if (selected === null) return <p className="text-base text-ink-secondary">No fields on this order.</p>;

  const editorSeed = seed ?? selected.value ?? readingsOf(selected)[0]?.value ?? "";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-baseline gap-6">
        <ScreenTitle>Review</ScreenTitle>
        <span className="font-mono text-xs text-ink-muted">{queued.length} remaining</span>
      </header>

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <OrderRail orderId={orderId} />

        <div className="flex flex-col gap-8">
          <DecisionPanel
            field={selected}
            pinned={pinned}
            onPin={setPinned}
            onAdopt={(value) => {
              setSeed(value);
              setMode("correct");
            }}
            onConfirm={() => submitConfirm()}
            onCorrect={() => {
              setSeed(null);
              setMode("correct");
            }}
            onEscalate={() => setMode("escalate")}
            onPass={() => setMode("pass")}
          >
            <ReviewEditors
              mode={mode}
              editorKey={`${selected.id}:${editorSeed}`}
              seed={editorSeed}
              passPending={pass.isPending}
              serverNote={confirm.error instanceof ApiError ? confirm.error.message : null}
              blankNote={blankNote}
              onCancel={() => setMode("idle")}
              onCorrect={(value, reason) =>
                correct.mutate({ fieldId: selected.id, value, reason }, { onSuccess: advance })
              }
              onEscalate={(question) =>
                escalate.mutate({ fieldId: selected.id, question }, { onSuccess: advance })
              }
              onPass={(reason) => pass.mutate(reason, { onSuccess: () => setMode("idle") })}
            />
          </DecisionPanel>

          <FieldList fields={fields} selectedPath={selected.path} onSelect={reselect} />
        </div>
      </div>
    </div>
  );
}
