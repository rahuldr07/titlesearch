import type { Field } from "@titlepipe/contract";
import { useEffect, useRef, useState } from "react";
import { noValueOf } from "../../entities/field/noValueState";
import { isTypingTarget } from "./keys";
import { useFieldDecision } from "./useFieldDecision";

/**
 * The three decisions a reviewer makes on a field: confirm, correct, escalate.
 *
 * DEPARTS FROM design-mock/ ON TWO POINTS — conflicts C8 and C9, both
 * release-blocking against invariants that pass today:
 *
 *   C8 — the design's "✎ Correct it" submits a value with NO reason field.
 *   C9 — the design's "↗ Escalate" submits with NO question field.
 *
 * Both are built here WITH the required field, because `review.spec`
 * ("correction without a reason never submits", "escalation without a question
 * never submits"), master §0.5 and CONTEXT §7 all require the refusal, and the
 * design's own escalation screen renders a "Reason" that its review screen never
 * collects. Logged for redraw in docs/frontend/conflicts.md — the pattern used
 * here is the design's own required-comment treatment from the completeness gate.
 *
 * A refused submit SAYS WHY (orphan O10). A disabled control that does not
 * explain itself trains reviewers to work around it.
 *
 * ⏎ NEVER ACCEPTS A BLANK (orphan O9): the keyboard fast path confirms values;
 * accepting an NA or missing field takes an explicit click. That asymmetry is
 * deliberate — it is the only thing stopping a reviewer holding Enter through a
 * run of absences, and it is the closest thing to an anti-approve-all mechanism
 * at the keyboard layer.
 *
 * There is deliberately NO bulk control here. No approve-all, no accept-
 * remaining, no "confirm the rest". The component does not exist (constraint 6).
 */

type Panel = "none" | "correct" | "escalate";

export function FieldActions({
  field,
  orderId,
  onSettled,
  adopted,
}: {
  field: Field;
  orderId: string;
  /** advance only on ACCEPTANCE — never on a refusal */
  onSettled: () => void;
  /**
   * A reading the reviewer chose to adopt (orphan O11). The counter makes
   * adopting the same value twice re-open the editor rather than look broken.
   */
  adopted?: { value: string; n: number } | null;
}) {
  const d = useFieldDecision(orderId);
  const [panel, setPanel] = useState<Panel>("none");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [question, setQuestion] = useState("");
  const [nudge, setNudge] = useState<string | null>(null);

  // A new field is a clean slate — a half-typed reason must never carry across
  // to a different field. Draft work lives in memory only (constraint 11).
  useEffect(() => {
    setPanel("none");
    setValue("");
    setReason("");
    setQuestion("");
    setNudge(null);
    d.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id]);

  const nv = noValueOf(field);
  // Confirming a field with no settled value means accepting an absence. That
  // is a real decision and it takes an explicit click, never the ⏎ fast path.
  const confirmingAnAbsence = nv !== null;

  const valueRef = useRef<HTMLInputElement | null>(null);
  const questionRef = useRef<HTMLInputElement | null>(null);

  /**
   * Adopting a reading opens the correction editor PREFILLED with that reading's
   * exact text — no retyping (orphan O11). The reason is deliberately NOT
   * prefilled: the reviewer still has to say why this reading is the right one,
   * because that is what makes the correction reviewable and able to become a
   * rule. Adopting is choosing a value, not skipping the justification.
   */
  useEffect(() => {
    if (adopted == null) return;
    setValue(adopted.value);
    setNudge(null);
    setPanel("correct");
  }, [adopted?.value, adopted?.n]);

  // focus follows the panel that just opened, so the keyboard path never
  // strands the reviewer having to reach for the mouse
  useEffect(() => {
    if (panel === "correct") valueRef.current?.focus();
    if (panel === "escalate") questionRef.current?.focus();
  }, [panel]);

  /**
   * Decision keys: C correct · E escalate · ⏎ confirm.
   *
   * ⏎ NEVER ACCEPTS A BLANK (orphan O9). On a field with no settled value,
   * Enter does nothing at all and the reviewer must click "Accept as stated".
   * That asymmetry is the point: it is what stops someone holding Enter through
   * a run of absences, and it is the nearest thing to an anti-approve-all
   * mechanism at the keyboard layer.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      /*
       * Escape is the ONE key allowed through from inside an input, because it
       * is a cancel rather than text — no keystroke produces an Escape
       * character, so nothing is lost by claiming it. Everything else defers to
       * the typing guard below (O15).
       */
      if (e.key === "Escape") {
        e.preventDefault();
        setPanel("none"); // the draft is discarded, not stashed
        setNudge(null);
        d.reset();
        return;
      }
      if (isTypingTarget(e.target)) return; // O15
      const k = e.key.toLowerCase();
      if (k === "c") {
        e.preventDefault();
        setNudge(null);
        setValue(field.value ?? "");
        setPanel("correct");
      } else if (k === "e") {
        e.preventDefault();
        setNudge(null);
        setPanel("escalate");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (confirmingAnAbsence) {
          // deliberately inert, and it says so rather than failing silently
          setNudge(
            "⏎ does not accept an absence. Accepting “not available” is a decision — click it.",
          );
          return;
        }
        doConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id, field.value, confirmingAnAbsence, panel]);

  const doConfirm = () => {
    setNudge(null);
    d.confirm.mutate(
      { fieldId: field.id, value: field.value },
      {
        onSuccess: () => onSettled(),
        // a 409 is an answer: it renders, and the selection does NOT move
        onError: () => undefined,
      },
    );
  };

  const doCorrect = () => {
    if (!reason.trim()) {
      setNudge("A correction needs both the value and its why.");
      return;
    }
    setNudge(null);
    d.correct.mutate(
      { fieldId: field.id, value: value.trim() === "" ? null : value, reason },
      { onSuccess: () => onSettled(), onError: () => undefined },
    );
  };

  const doEscalate = () => {
    if (!question.trim()) {
      setNudge("An escalation needs its question — what do you not know?");
      return;
    }
    setNudge(null);
    d.escalate.mutate(
      { fieldId: field.id, question },
      { onSuccess: () => onSettled(), onError: () => undefined },
    );
  };

  const btn =
    "rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-50";

  return (
    <div data-testid="field-actions" className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="act-confirm"
          disabled={d.pending}
          onClick={doConfirm}
          className={`${btn} border-state-settled bg-surface-panel text-state-settled`}
        >
          ✓ {confirmingAnAbsence ? "Accept as stated" : "Confirm"}
        </button>
        <button
          type="button"
          data-testid="act-correct"
          onClick={() => {
            setPanel(panel === "correct" ? "none" : "correct");
            setValue(field.value ?? "");
            setNudge(null);
          }}
          className={`${btn} border-page-ref bg-page-ref-surface text-page-ref-ink`}
        >
          ✎ Correct it
        </button>
        <button
          type="button"
          data-testid="act-escalate"
          onClick={() => {
            setPanel(panel === "escalate" ? "none" : "escalate");
            setNudge(null);
          }}
          className={`${btn} border-state-attend bg-surface-panel text-state-attend`}
        >
          ↗ Escalate — I don&rsquo;t know the rule
        </button>
      </div>

      {/* the server's refusal, verbatim — never a generic failure toast */}
      {d.error !== null ? (
        <div
          data-testid="confirm-note"
          className="mt-2 rounded-md border border-state-halt-border bg-state-halt-surface px-3 py-2 text-sm text-state-halt-ink"
        >
          server: {d.error.message}
        </div>
      ) : null}

      {nudge !== null ? (
        <div
          data-testid="nudge"
          className="mt-2 rounded-md border border-state-attend-border bg-state-attend-surface px-3 py-2 text-sm text-state-attend-ink"
        >
          {nudge}
        </div>
      ) : null}

      {panel === "correct" ? (
        <div className="mt-2 rounded-md border border-page-ref-border bg-surface-panel p-3">
          <label className="block text-micro font-bold tracking-badge text-ink-muted uppercase">
            Correct to
          </label>
          <input
            ref={valueRef}
            data-testid="edit-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            /*
             * Enter from the VALUE field attempts the correction too, so it is
             * refused-and-explained rather than silently ignored. Without this
             * the field swallowed Enter entirely — a dead keystroke, which is
             * the exact failure O10 exists to prevent: the reviewer presses
             * Enter, nothing happens, and nothing tells them why.
             */
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doCorrect();
              }
            }}
            className="mt-1 w-full rounded-sm border border-line-strong bg-surface-panel px-2 py-1.5 font-mono text-md text-ink-primary"
          />
          {/*
            C8: the design omits this field entirely. It is required by
            `review.spec` and by the contract schema, and it is what makes a
            correction reviewable later and able to produce a rule (principle 3).
          */}
          <label className="mt-3 block text-micro font-bold tracking-badge text-state-halt-ink uppercase">
            Why — required
          </label>
          <input
            data-testid="edit-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="A correction with no reason cannot become a rule."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doCorrect();
              }
            }}
            className="mt-1 w-full rounded-sm border border-state-halt-border bg-surface-panel px-2 py-1.5 text-sm text-ink-primary"
          />
          <button
            type="button"
            data-testid="edit-submit"
            disabled={d.pending}
            onClick={doCorrect}
            className={`${btn} mt-3 border-page-ref bg-page-ref text-ink-on-action`}
          >
            Record the correction
          </button>
        </div>
      ) : null}

      {panel === "escalate" ? (
        <div className="mt-2 rounded-md border border-state-attend-border bg-surface-panel p-3">
          {/*
            C9: the design omits this too, while its escalation screen renders a
            "Reason" it never collected. The question IS the escalation — an
            escalation with no question is a shrug with a ticket number.
          */}
          <label className="block text-micro font-bold tracking-badge text-state-attend-ink uppercase">
            Your question — required
          </label>
          <input
            ref={questionRef}
            data-testid="escalate-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you not know? e.g. which source wins when the order sheet and the deed disagree?"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doEscalate();
              }
            }}
            className="mt-1 w-full rounded-sm border border-state-attend-border bg-surface-panel px-2 py-1.5 text-sm text-ink-primary"
          />
          <button
            type="button"
            data-testid="escalate-submit"
            disabled={d.pending}
            onClick={doEscalate}
            className={`${btn} mt-3 border-state-attend bg-state-attend text-ink-on-action`}
          >
            Send it up
          </button>
        </div>
      ) : null}
    </div>
  );
}
