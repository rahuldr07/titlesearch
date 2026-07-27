import { useQuery } from "@tanstack/react-query";
import { canDo } from "@titlepipe/contract";
import { rulesQuery, useConfirmRule } from "./queries";
import { useSession } from "../../shared/session";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Button } from "../../shared/ui/Button";

/**
 * The rulebook. Every rule carries its origin, status and jurisdiction scope,
 * and a PENDING rule says on its face that it cannot affect anything.
 *
 * "PENDING — CANNOT AFFECT THE PIPELINE" is not decoration. A drafted rule is
 * inert until an engineer confirms it (load-bearing rule 7), and a reviewer
 * who cannot tell a pending rule from a live one will follow one that is not
 * yet policy. The wording is the harvested assertion's, verbatim.
 *
 * THE CONFIRM AFFORDANCE IS ABSENT FOR NON-HOLDERS, not disabled
 * (`authz.spec` #5). `canDo` is the same table the server gates with, so the
 * button cannot appear for someone the server would refuse.
 */
export function RulebookTab() {
  const role = useSession((s) => s.role);
  const { data, isPending, isError } = useQuery(rulesQuery);
  const confirm = useConfirmRule();

  if (isError) return <p className="text-base text-state-halt-ink">Rulebook unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the rulebook…</p>;

  return (
    <ul className="flex flex-col gap-5">
      {data.rules.map((rule) => {
        const pending = rule.status === "pending";
        const mayConfirm = canDo(role, "rule.confirm", { status: rule.status });

        return (
          <li key={rule.id}>
            <Card data-testid={`rule-${rule.code}`}>
              <CardHeader filled>
                <span className="font-mono text-md font-semibold">{rule.code}</span>
                <Chip tone={pending ? "attend" : "settled"} size="sm" bordered>
                  {pending ? "PENDING — CANNOT AFFECT THE PIPELINE" : "LIVE"}
                </Chip>
                <Chip tone="neutral" size="micro" className="ml-auto">
                  {rule.origin}
                </Chip>
                {rule.jurisdiction_scope ? (
                  <Chip tone="neutral" size="micro">{rule.jurisdiction_scope}</Chip>
                ) : null}
              </CardHeader>

              <CardBody>
                <p className="text-base leading-body text-ink-primary">{rule.text}</p>
                <p className="mt-4 text-xs text-ink-muted">
                  v{rule.version}
                  {rule.confirmed_by ? ` · confirmed by ${rule.confirmed_by}` : ""}
                </p>

                {mayConfirm ? (
                  <div className="mt-6">
                    <Button
                      size="sm"
                      data-testid={`confirm-${rule.code}`}
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(rule.id)}
                    >
                      Confirm → make LIVE
                    </Button>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
