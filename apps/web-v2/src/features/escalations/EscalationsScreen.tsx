import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Escalation } from "@titlepipe/contract";
import { escalationsQuery, rulesQuery } from "./queries";
import { ClusterRail, type Cluster } from "./ClusterRail";
import { ResolveCard } from "./ResolveCard";
import { RuleStamp } from "./RuleStamp";
import { ScreenTitle } from "../../app/ScreenTitle";

function clusterBy(escalations: readonly Escalation[]): Cluster[] {
  const byPath = new Map<string, Escalation[]>();
  for (const item of escalations) {
    byPath.set(item.field_path_cluster, [...(byPath.get(item.field_path_cluster) ?? []), item]);
  }
  return [...byPath.entries()].map(([path, items]) => ({
    path,
    items,
    open: items.filter((item) => item.resolution === null),
  }));
}

/**
 * ESCALATION INBOX — a rules backlog. Every item is a reviewer saying "I do not
 * know the rule", and the answer to that is never an answer: it is a rule.
 *
 * OPEN IS `resolution === null`, read off the record. There is no status field
 * in the contract and the client invents none — a locally-tracked "resolved"
 * flag would survive a failed POST and quietly hide an unanswered wall.
 */
export function EscalationsScreen() {
  const escalations = useQuery(escalationsQuery);
  const rules = useQuery(rulesQuery);
  const [selected, setSelected] = useState<string | null>(null);

  if (escalations.isError) {
    return <p className="text-base text-state-halt-ink">Inbox unavailable.</p>;
  }
  if (escalations.isPending) {
    return <p className="text-base text-ink-secondary">Loading the inbox…</p>;
  }

  const clusters = clusterBy(escalations.data.escalations);
  const fallback = clusters.find((c) => c.open.length > 0) ?? clusters[0];
  const current = clusters.find((c) => c.path === selected) ?? fallback;

  if (current === undefined) {
    return <p className="text-base text-ink-secondary">No escalations. Nobody is stuck.</p>;
  }

  const answered = current.items.find((item) => item.resolution !== null);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <ScreenTitle>Escalation inbox</ScreenTitle>
        <p className="max-w-3xl text-base leading-body text-ink-secondary">
          A rules backlog — every item is a reviewer saying &ldquo;I don&rsquo;t
          know the rule&rdquo;. Answering one order is not the job; writing the
          rule that answers the next fifty is.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <ClusterRail clusters={clusters} selected={current.path} onSelect={setSelected} />

        <section className="flex flex-col gap-6">
          <h2 className="font-mono text-md font-semibold text-ink-primary">{current.path}</h2>

          <ul className="flex flex-col gap-3">
            {current.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1">
                <p className="text-base leading-body text-ink-primary">
                  &ldquo;{item.question}&rdquo;
                </p>
                <p className="font-mono text-tiny text-ink-muted">
                  {item.order_ids.join(" · ")}
                </p>
              </li>
            ))}
          </ul>

          {current.open.length > 0 ? (
            <ResolveCard
              ids={current.open.map((item) => item.id)}
              rules={rules.data?.rules ?? []}
              onResolved={() => setSelected(current.path)}
            />
          ) : (
            <div className="flex flex-col gap-4 rounded-6 border border-state-settled-border bg-state-settled-surface p-8">
              <p className="text-md font-semibold text-state-settled-ink">
                ✓ Rule written — cluster cleared.
              </p>
              {answered === undefined ? null : (
                <>
                  <p className="text-base leading-body text-ink-secondary">
                    &ldquo;{answered.resolution}&rdquo; — {answered.resolved_by}
                  </p>
                  <div>
                    <RuleStamp
                      rule={rules.data?.rules.find((rule) => rule.id === answered.rule_id)}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
