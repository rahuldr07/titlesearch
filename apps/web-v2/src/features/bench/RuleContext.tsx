import { useQuery } from "@tanstack/react-query";
import { rulesQuery } from "./queries";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * THE PROMPT IS GENERATED FROM THE RULEBOOK (`bench.spec` #3). Every rule that
 * governs extraction is listed here by code, so a prompt change is traceable to
 * a rule change rather than to somebody's afternoon.
 *
 * PENDING RULES ARE ABSENT BY CONSTRUCTION. A prompt IS the pipeline, and a
 * pending rule cannot affect the pipeline until an engineer confirms it — so
 * including one here, even greyed, would be the confirmation gate leaking. The
 * count of what is being withheld is shown instead.
 */
export function RuleContext() {
  const { data, isPending, isError } = useQuery(rulesQuery);

  if (isError) return <p className="text-base text-state-halt-ink">Rulebook unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the rulebook…</p>;

  const live = data.rules.filter((rule) => rule.status === "live");
  const withheld = data.rules.filter((rule) => rule.status === "pending").length;

  return (
    <section className="flex flex-col gap-4">
      <Eyebrow variant="section">Prompt — generated from the rulebook</Eyebrow>
      <p className="max-w-3xl text-xs leading-body text-ink-muted">
        A rule change propagates to every engine at once. There is no per-engine
        prompt surgery, because two engines editing away from each other stop
        answering the same question.
      </p>

      <dl data-testid="rulecontext" className="flex flex-col gap-4">
        {live.map((rule) => (
          <div key={rule.id} className="grid grid-cols-[7rem_1fr] gap-x-6">
            <dt className="font-mono text-xs font-semibold text-ink-primary">{rule.code}</dt>
            <dd className="text-xs leading-body text-ink-secondary">{rule.text}</dd>
          </div>
        ))}
      </dl>

      {withheld === 0 ? null : (
        <p className="text-xs leading-body text-state-attend-ink">
          {withheld} pending{" "}
          {withheld === 1 ? "rule is" : "rules are"} absent from this prompt by
          construction — a pending rule cannot affect the pipeline until an
          engineer confirms it.
        </p>
      )}
    </section>
  );
}
