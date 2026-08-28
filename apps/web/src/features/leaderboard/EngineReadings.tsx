import type { LeaderboardCell } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { engineLeaderboard } from "../../shared/engineQueries";
import { Empty, Table, type TableColumn } from "../../components/ui";
import { QueryState } from "../../entities/state/QueryState";
import { StatedNumber, TagReading } from "./ReadingCells";

/**
 * ENGINE × JURISDICTION × SECTION, MEASURED AGAINST THE GOLDEN SET.
 *
 * One row per `LeaderboardCell`, in the order the server sent them. The tag
 * columns are discovered from the payload in first-appearance order rather than
 * hard-coded from `GoldenTag`, so a tag the server stops reporting stops having
 * a column instead of gaining a column of blanks.
 *
 * ══ THE ROW IS THE UNIT, AND THE ENGINE IS NOT ═════════════════════════════
 *
 * There is deliberately no grouping by engine, no per-engine summary row and no
 * total. `claude-api` reading 0.986 on Clayton mortgages and 1 on Hartford
 * mortgages are two facts about two cells; the thing that would join them is an
 * average whose denominator nobody could name, and `entities.ts:271-274` says
 * the contract has no aggregate schema on purpose. A grand total row is the
 * accuracy headline in a table's clothing.
 *
 * ══ COST AND LATENCY SIT WHERE THEY WERE MEASURED ══════════════════════════
 *
 * Both are per cell in the payload and are printed per cell. They are facts
 * about calls (AGENTS.md: "cost + latency recorded per call"), not a rate at
 * which anyone works — INVARIANT 23's ban is on pace, and there is no per-hour,
 * per-person or per-period figure anywhere on this screen.
 */
export function EngineReadings() {
  const readings = useRead(engineLeaderboard);

  return (
    <section aria-labelledby="engine-readings-heading" className="flex min-h-0 flex-col gap-6">
      <h2
        id="engine-readings-heading"
        className="text-label font-bold leading-flat text-ink-muted"
      >
        Accuracy by golden tag, per engine, section and jurisdiction
      </h2>
      <QueryState query={readings} of="the engine readings">
        {(data) => (
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line-strong bg-surface-panel">
            <Table
              label="Engine readings against the golden set"
              rows={data.cells}
              columns={columnsFor(data.cells)}
              rowKey={(cell) =>
                `${cell.engine_id}|${cell.jurisdiction}|${cell.section}`
              }
              empty={
                <Empty
                  title="No readings in this response"
                  reason="The server returned no cells. Nothing on this screen filters them — this is the whole answer."
                />
              }
            />
          </div>
        )}
      </QueryState>
    </section>
  );
}

/** Mono, because every one of these is an identifier the server gates on. */
function Ref({ children }: { readonly children: string }) {
  return (
    <span className="truncate font-mono text-meta leading-close text-ink-primary">
      {children}
    </span>
  );
}

function columnsFor(cells: readonly LeaderboardCell[]): TableColumn<LeaderboardCell>[] {
  const tags: string[] = [];
  for (const cell of cells) {
    if (cell.accuracy_by_tag === null) continue;
    for (const tag of Object.keys(cell.accuracy_by_tag)) {
      if (!tags.includes(tag)) tags.push(tag);
    }
  }

  return [
    { id: "engine", header: "Engine", width: "minmax(0,1.4fr)", cell: (c) => <Ref>{c.engine_id}</Ref> },
    { id: "jurisdiction", header: "Jurisdiction", width: "minmax(0,1fr)", cell: (c) => <Ref>{c.jurisdiction}</Ref> },
    { id: "section", header: "Section", width: "minmax(0,1.2fr)", cell: (c) => <Ref>{c.section}</Ref> },
    ...tags.map((tag) => ({
      id: `tag-${tag}`,
      header: tag,
      width: "minmax(0,1fr)",
      cell: (c: LeaderboardCell) => <TagReading cell={c} tag={tag} />,
    })),
    {
      id: "coverage",
      header: "Golden fields",
      width: "minmax(0,0.8fr)",
      cell: (c) => <StatedNumber value={c.golden_coverage} />,
    },
    {
      id: "cost",
      header: "Cost per 1k pages (USD)",
      width: "minmax(0,1fr)",
      cell: (c) => <StatedNumber value={c.cost_per_1k_pages_usd} />,
    },
    {
      id: "p95",
      header: "p95 latency (ms)",
      width: "minmax(0,1fr)",
      cell: (c) => <StatedNumber value={c.p95_latency_ms} />,
    },
  ];
}
