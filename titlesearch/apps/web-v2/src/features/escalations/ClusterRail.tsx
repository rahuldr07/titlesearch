import type { Escalation } from "@titlepipe/contract";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

export interface Cluster {
  path: string;
  items: Escalation[];
  open: Escalation[];
}

/** "1 order", not "1 orders" — the same phrase recurs on queue and overview. */
function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
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
 *
 * RULE: a list of things you pick between has to LOOK like one. FAILURE
 * PREVENTED: drawn as borderless rows on the page ground with the selected one
 * carrying a faint fill, the rail read as unstyled text — and the selection was
 * the weakest mark on the screen. The archive draws a sunken 380px column with
 * a right rule and every cluster as a card; the picked one takes an ACCENT EDGE
 * rather than a fill alone, which is this design's convention for a chosen item
 * and the one that survives greyscale.
 *
 * THE CAPTION FITS AT 380px. At 320 it stranded "BY TIME" on a second line,
 * splitting the phrase mid-idiom — 9px with `tracking-label` is already the
 * type floor, so the column widened instead of the type shrinking.
 *
 * `aria-current` and not `aria-selected`: these are navigation targets, not
 * options in a listbox, and the rail is a `<nav>`.
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
      <Card
        size="nested"
        accent={cluster.path === selected ? "action" : "none"}
        className="p-0"
      >
        <button
          type="button"
          data-testid={`cluster-${cluster.path}`}
          aria-current={cluster.path === selected}
          onClick={() => onSelect(cluster.path)}
          className="flex w-full flex-col gap-1 px-6 py-5 text-left hover:bg-row-hover"
        >
          <span className="font-mono text-xs text-ink-primary">{cluster.path}</span>
          <span className="text-tiny text-ink-muted">{subtitle}</span>
        </button>
      </Card>
    </li>
  );

  return (
    <nav className="flex flex-col gap-6 border-r border-line-strong bg-surface-sunken p-5">
      <div>
        <Eyebrow variant="caption">
          Open — grouped by what is confusing people, not by time
        </Eyebrow>
        <ul className="mt-3 flex flex-col gap-3">
          {open.map((cluster) =>
            item(
              cluster,
              `${cluster.open.length} unanswered · ${plural(
                new Set(cluster.items.flatMap((e) => e.order_ids)).size,
                "order",
              )}`,
            ),
          )}
        </ul>
      </div>

      {answered.length === 0 ? null : (
        <div>
          <Eyebrow variant="caption">Resolved — rules written</Eyebrow>
          <ul className="mt-3 flex flex-col gap-3">
            {answered.map((cluster) => item(cluster, "answered — the rule is in the book"))}
          </ul>
        </div>
      )}
    </nav>
  );
}
