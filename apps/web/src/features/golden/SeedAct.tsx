import { useState } from "react";
import type { GoldenField } from "@titlepipe/contract";
import {
  Alert,
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from "../../components/ui";
import { useSession } from "../../shared/session";
import { notify } from "../../shared/notify";
import { seedActHold, useSeedAct, type SeedActMode } from "./useSeedAct";

/**
 * THE OPEN DECISION ON A SEED ROW — confirm, or demote, and nothing else.
 *
 * RECIPES §Open decision: a 3px accent left rail, no fill box, one primary
 * action and ghosts beside it, "the only accent-dominant element on the
 * screen". `GoldenScreen` opens exactly one of these at a time, which is what
 * keeps rule 1's single accent spend true of a list.
 *
 * ══ TWO ARMS, BECAUSE THE CONTRACT HAS TWO ENDPOINTS ═══════════════════════
 *
 * `endpoints.ts:285-310` names three seed actions and this screen holds two of
 * them. There is no third radio here for "leave it alone": leaving it alone is
 * not filing a record, and an act that files nothing does not belong in a form
 * whose entire purpose is the permanent log.
 *
 * ══ THE REFUSAL IS DURABLE, NOT A TOAST ════════════════════════════════════
 *
 * `INVARIANTS:14` and `:16`. The server's message renders HERE, in place, and
 * the row does not move — a 409 is an ANSWER. `useSeedAct` also toasts it, but
 * a toast is dismissible and a refusal a reader dismissed is a refusal they
 * cannot re-read. Nothing on this path composes, prefixes or edits the
 * sentence: `Alert.message` is a `string` for exactly that reason.
 *
 * ══ ONE ACT FILES ONE RECORD ═══════════════════════════════════════════════
 *
 * `INVARIANTS:20`. The submit is disabled by `seedActHold` while the mutation
 * is in flight, so three clicks — including three inside one tick, since the
 * hold is computed from `isPending` on every render rather than from a ref —
 * file one act.
 */
export function SeedAct(props: {
  readonly seed: GoldenField;
  readonly onFiled: () => void;
}) {
  const [mode, setMode] = useState<SeedActMode>("confirm");
  const [reason, setReason] = useState("");
  /* Read-only from the session, never typed. `session.ts:27` pins the rule:
     "the signer is not a client field — it's shown read-only from the
     session". The server derives its own; this is what the reader is told
     they are about to sign as. */
  const signature = useSession((state) => state.actor);
  const act = useSeedAct(props.seed.id);
  const held = seedActHold(props.seed, reason, signature, act.isPending);

  return (
    <div className="flex flex-col gap-8 border-l-3 border-action pl-8">
      <RadioGroup
        aria-label="Which seed act to file"
        value={mode}
        onChange={(value) => setMode(value === "demote" ? "demote" : "confirm")}
        className="flex flex-col gap-5"
      >
        <RadioGroupItem value="confirm" data-testid="seed-act-confirm">
          The seed is right; the model failure is real
        </RadioGroupItem>
        <RadioGroupItem value="demote" data-testid="seed-act-demote">
          The document is ambiguous; neither value is defensible
        </RadioGroupItem>
      </RadioGroup>

      <div className="flex flex-col gap-4">
        <Label htmlFor={`seed-reason-${props.seed.id}`}>
          Why, in the words that go on the permanent record
        </Label>
        <Textarea
          id={`seed-reason-${props.seed.id}`}
          data-testid="seed-reason"
          aria-label="Why, in the words that go on the permanent record"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-sans text-label leading-flat font-bold text-ink-faint">
          Signed by
        </span>
        {/* Rule 3: a signer's recorded identity is a record, so it is mono. */}
        <span className="font-mono text-meta leading-close text-ink-secondary">
          {signature.trim().length === 0 ? "no session identity" : signature}
        </span>
        <span className="font-sans text-label leading-body text-ink-muted">
          Read-only. The server stamps the signer from the session — a signature
          the client can type is not a signature (endpoints.ts:296).
        </span>
      </div>

      {act.isError && act.error !== null && (
        <div data-testid="seed-act-refusal">
          <Alert tone="halt" title="Refused" message={act.error.message} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-6">
        <Button
          data-testid="seed-act-file"
          variant="primary"
          disabledBecause={held}
          onPress={() =>
            act.mutate(
              { act: mode, body: { reason } },
              {
                onSuccess: () => {
                  notify.success(
                    mode === "confirm"
                      ? "Seed confirmed — signed and on the record."
                      : "Seed demoted to suspect — signed and on the record.",
                  );
                  setReason("");
                  props.onFiled();
                },
              },
            )
          }
        >
          {held === null
            ? mode === "confirm"
              ? "Confirm the seed"
              : "Demote the seed"
            : "Held — permanent, so it needs a reason"}
        </Button>
        <Button variant="ghost" onPress={props.onFiled}>
          Leave it as it is
        </Button>
      </div>
    </div>
  );
}
