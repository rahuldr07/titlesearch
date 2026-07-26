import { useEffect, useRef, useState } from "react";

/**
 * A text input that REFUSES to submit while empty, and says why when it does.
 *
 * This one component carries most of the §0.5 refusal rules, so it is built once
 * and used everywhere they appear:
 *
 *   correction reason · escalation question · escalation RULING · pass reason ·
 *   root-of-title comment · product-change reason · golden correction reason ·
 *   reconciliation citation · complaint resolution · v2 reopen reason
 *
 * Two rules are baked in and must not be undone by a caller:
 *
 * 1. The submit is DISABLED while empty — the refusal is structural, not a
 *    validation message after the fact.
 * 2. A refused submit SAYS WHY (orphan rule O10). A disabled control that does
 *    not explain itself reads as a broken button and trains people to work
 *    around it. `nudge` is rendered on an attempted-but-refused submit, not on
 *    first render — telling someone off before they have done anything is noise.
 *
 * The server refuses independently. This is ergonomics; it is never the gate
 * (constraint 14).
 */
export function RequiredComment({
  label,
  placeholder,
  nudge,
  submitLabel,
  testId,
  submitTestId,
  nudgeTestId = "nudge",
  autoFocus = false,
  multiline = false,
  disabled = false,
  onSubmit,
}: {
  label: string;
  placeholder?: string;
  /** shown when submit is attempted while empty — must name what is missing */
  nudge: string;
  submitLabel: string;
  testId: string;
  submitTestId: string;
  nudgeTestId?: string;
  autoFocus?: boolean;
  multiline?: boolean;
  disabled?: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [refused, setRefused] = useState(false);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const empty = text.trim() === "";

  const attempt = () => {
    if (empty) {
      setRefused(true);
      return;
    }
    setRefused(false);
    onSubmit(text.trim());
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      attempt();
    }
  };

  const field =
    "mt-1 w-full rounded-sm border bg-surface-panel px-2 py-1.5 text-sm text-ink-primary " +
    (refused ? "border-state-halt-border" : "border-line-strong");

  return (
    <div>
      <label className="block text-micro font-bold tracking-badge text-state-halt-ink uppercase">
        {label}
      </label>
      {multiline ? (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          data-testid={testId}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          className={`${field} resize-y font-sans`}
        />
      ) : (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          data-testid={testId}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className={field}
        />
      )}

      {refused ? (
        <div
          data-testid={nudgeTestId}
          className="mt-2 rounded-md border border-state-attend-border bg-state-attend-surface px-2 py-1.5 text-sm text-state-attend-ink"
        >
          {nudge}
        </div>
      ) : null}

      <button
        type="button"
        data-testid={submitTestId}
        // Enter is handled above so the keyboard path works even while the
        // button is disabled — that is what produces the nudge instead of a
        // dead keystroke.
        disabled={empty || disabled}
        onClick={attempt}
        className="mt-2 rounded-md border border-page-ref bg-page-ref px-3 py-1.5 text-sm font-semibold text-ink-on-action disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}
