import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { benchResultsQuery } from "./queries";
import { BenchMatrix } from "./BenchMatrix";
import { FailRow } from "./FailRow";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";

/**
 * BENCH RESULTS — a matrix and its failures, and NO AGGREGATE HEADLINE
 * (`bench.spec` #1). The design carried one; it is dropped, not restyled.
 *
 * The cell counts and the section counts are rendered EACH VERBATIM and never
 * reconciled against each other. They disagree in the current fixture, and
 * silently correcting that in the client would hide a real server-side defect
 * behind arithmetic — and the arithmetic that would do it is exactly the
 * aggregate this screen refuses.
 *
 * ONE ROW EXPANDS AT A TIME. Two open panels means two "Investigate seed →"
 * links, and the point of the link is that it carries ONE field into the one
 * screen where ground truth changes.
 */
export function BenchResults() {
  const { data, isPending, isError } = useQuery(benchResultsQuery);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isError) return <p className="text-base text-state-halt-ink">Bench results unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the run…</p>;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Eyebrow variant="screen">Bench results</Eyebrow>
        <p className="font-mono text-xs text-ink-muted">
          {data.run_ref} · {data.seed_version} · {data.total_fields} fields ·{" "}
          {data.orders} real orders
        </p>
      </header>

      <BenchMatrix cells={data.cells} />

      {data.sections.map((section) => (
        <Card key={section.section} accent={section.suspect_note === null ? "none" : "attend"}>
          <CardHeader filled>
            <Eyebrow variant="section">{section.section}</Eyebrow>
            <span className="font-mono text-xs text-ink-muted">
              {section.passed}/{section.n} pass
            </span>
            {section.suspect_note === null ? null : (
              <Chip tone="attend" size="micro" bordered>
                SUSPECT SEED
              </Chip>
            )}
          </CardHeader>
          <CardBody className="flex flex-col gap-4 p-0">
            {section.suspect_note === null ? null : (
              <p className="px-8 pt-5 text-xs leading-body text-state-attend-ink">
                {section.suspect_note}
              </p>
            )}
            {section.note === null ? null : (
              <p className="px-8 pt-5 text-xs leading-body text-ink-muted">{section.note}</p>
            )}

            {section.fails.length === 0 ? (
              <p className="px-8 py-5 text-xs text-ink-muted">
                {section.passed} passing — collapsed; passes take no space.
              </p>
            ) : (
              <ul>
                {section.fails.map((row) => (
                  <FailRow
                    key={row.path}
                    row={row}
                    expanded={expanded === row.path}
                    onToggle={() => setExpanded(expanded === row.path ? null : row.path)}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ))}

      <p className="max-w-3xl text-xs leading-body text-ink-muted">
        Read-only — fixes happen in the code, not here. There is no run-over-run
        delta on purpose: the seed is the comparand, not last time.
      </p>
    </div>
  );
}
