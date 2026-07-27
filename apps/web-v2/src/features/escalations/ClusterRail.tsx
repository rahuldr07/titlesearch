import type { Escalation } from "@titlepipe/contract";
import { cn } from "../../shared/ui/classNames";
import { Eyebrow } from "../../shared/ui/Eyebrow";

export interface Cluster {
  path: string;
  items: Escalation[];
  open: Escalation[];
}

/**
 * GROUPED BY WHAT IS CONFUSING PEOPLE, NOT BY TIME.
 *
 * Sorting an escalation inbox by age turns it into a backlog to burn down, and
 * then the same wall gets hit five times by five people and answered five ways.
 * Grouped by field cluster, five escalations are ONE missing rule — which is
 * both less work and the only framing that produces a rule at the end.
 *
 * NO TRIAGE FURNITURE (`escalations.spec` #4): no category, no priority, no
 * assignee. Every one of those is a way to defer writing the rule while looking
 * busy, and none of them exists in the contract either.
 */
export function ClusterRail({
  clusters,
  selected,
  onSelect,
}: {
  clusters: readonly Cluster[];
  selected: string;
  onSelect: (path: string) => void;
}) {
  const open = clusters.filter((c) => c.open.length > 0);
  const answered = clusters.filter((c) => c.open.length === 0);

  const item = (cluster: Cluster, subtitle: string) => (
    <li key={cluster.path}>
      <button
        type="button"
        data-testid={`cluster-${cluster.path}`}
        aria-current={cluster.path === selected}
        onClick={() => onSelect(cluster.path)}
        className={cn(
          "flex w-full flex-col gap-1 border-t border-line-subtle px-6 py-4 text-left",
          cluster.path === selected && "bg-surface-sunken",
        )}
      >
        <span className="font-mono text-xs text-ink-primary">{cluster.path}</span>
        <span className="text-tiny text-ink-muted">{subtitle}</span>
      </button>
    </li>
  );

  return (
    <nav className="flex flex-col gap-6">
      <div>
        <Eyebrow variant="caption">
          Open — grouped by what is confusing people, not by time
        </Eyebrow>
        <ul className="mt-2">
          {open.map((cluster) =>
            item(
              cluster,
              `${cluster.open.length} unanswered · ${new Set(cluster.items.flatMap((e) => e.order_ids)).size} orders`,
            ),
          )}
        </ul>
      </div>

      {answered.length === 0 ? null : (
        <div>
          <Eyebrow variant="caption">Resolved — rules written</Eyebrow>
          <ul className="mt-2">
            {answered.map((cluster) => item(cluster, "answered — the rule is in the book"))}
          </ul>
        </div>
      )}
    </nav>
  );
}
