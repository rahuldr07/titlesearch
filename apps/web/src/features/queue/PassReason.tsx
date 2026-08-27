import { useEffect, useRef, useState } from "react";
import { TextField } from "react-aria-components";
import { Button, Input, Kbd } from "../../components/ui";

/**
 * THE PASS REASON, AND THE REFUSAL IS THE PRODUCT.
 *
 * `INVARIANTS:52` (ORPHAN, and the only record of it): "a pass is refused
 * without its reason, and Escape keeps the order." `INVARIANTS:54`: "a reasoned
 * pass records and THE SERVER serves the next order." `endpoints.ts:206-210`
 * agrees from the other side — `PassOrderRequest.reason` is `z.string().min(1)`
 * and the mock's own comment reads "No reason, no pass — the refusal is the
 * product requirement."
 *
 * ══ THE EMPTY SUBMIT IS SWALLOWED HERE, NOT SENT ═══════════════════════════
 *
 * `INVARIANTS:55` says every refusal SPEAKS and "a silent no-op is the defect",
 * and `INVARIANTS:56` says the queue's pass refusal nudges too. So an empty
 * Enter does not post: it renders the nudge and keeps focus in the field. That
 * is the one refusal the client is allowed to author, for the same reason
 * `CredentialsForm` is — no server has been asked, so there is no server
 * sentence to surface verbatim. The moment the server DOES answer (a 403 from
 * the role gate, a 422 from the schema), `PassAction` surfaces ITS words and
 * never these.
 *
 * ══ ESCAPE KEEPS THE ORDER ═════════════════════════════════════════════════
 *
 * Escape closes the reason and leaves the served order exactly where it was. It
 * is handled on the INPUT rather than through the global chord layer: while
 * this field has focus it owns every key (`focusOwnership.ts`), which is the
 * same rule that stops `p` re-triggering the pass while somebody is typing the
 * word "pass" into the reason.
 *
 * ══ THE VALUE IS ON `TextField`, NOT ON `Input` ════════════════════════════
 *
 * `components/ui/input.tsx` omits `value` and `defaultValue` from `InputProps`
 * on purpose: `TextField` injects a controlled value through `InputContext`, a
 * caller's own value collides with it, and React drops one — the measured
 * result being a box that renders BLANK while every story still passes. So the
 * state lives on the field and `Input` is the box it draws.
 */
export function PassReason(props: {
  readonly onSubmit: (reason: string) => void;
  readonly onCancel: () => void;
  readonly pending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [nudge, setNudge] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Focus on open: the reviewer pressed `p` to say something, so the caret goes
  // where they can say it. `queue.spec` #3 asserts exactly this.
  useEffect(() => {
    input.current?.focus();
  }, []);

  function attempt() {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setNudge(true);
      input.current?.focus();
      return;
    }
    props.onSubmit(trimmed);
  }

  return (
    <div data-testid="pass-reason" className="flex flex-col gap-5">
      <div className="flex items-center gap-5">
        <TextField
          aria-label="Why are you passing this order?"
          value={reason}
          onChange={(next) => {
            setReason(next);
            if (nudge) setNudge(false);
          }}
          className="flex-1"
        >
          <Input
            ref={input}
            placeholder="Why are you passing this order?"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                attempt();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                props.onCancel();
              }
            }}
          />
        </TextField>
        <Button
          variant="secondary"
          onPress={attempt}
          disabledBecause={props.pending ? "Recording the pass." : undefined}
        >
          Record pass <Kbd muted>Enter</Kbd>
        </Button>
      </div>
      {nudge && (
        <p
          data-testid="pass-nudge"
          role="alert"
          className="text-meta leading-close text-state-halt"
        >
          A pass needs its reason — the next person inherits this order and the
          reason is what they inherit with it.
        </p>
      )}
      <p className="text-label leading-close text-ink-faint">
        Escape keeps this order.
      </p>
    </div>
  );
}
