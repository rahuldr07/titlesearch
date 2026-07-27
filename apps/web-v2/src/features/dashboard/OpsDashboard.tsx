import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { metricsQuery } from "./queries";
import { DrillDrawer } from "./DrillDrawer";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";

/**
 * The readout.
 *
 * CATCH RATE IS THE HEADLINE, AND IT ALWAYS CARRIES ITS DENOMINATOR
 * (`dashboard.spec` #1). A rate without an n is a number you cannot argue
 * with, and this one is measured on a few dozen planted probes a week.
 *
 * What is deliberately ABSENT (`dashboard.spec` #2, constraint 7):
 *   - any aggregate correctness figure. The word does not appear on this page,
 *     because one number over mixed jurisdictions and sections is not a fact
 *     about anything.
 *   - probe detail. The count is shown; which fields were planted is not, or
 *     reviewers would learn to spot them.
 *   - per-reviewer anything. No names, no ranking, no streaks. The system is
 *     measured here, not the people.
 */
export function OpsDashboard() {
  const { data, isPending, isError } = useQuery(metricsQuery);
  /*
   * Drill signals are NAMESPACED by the server — `field:{path}` for a backlog
   * row, `source:{name}` for a correction source. Passing the bare path 404s.
   * The namespace belongs to the server's vocabulary, not ours, so it is built
   * at the call site rather than guessed inside the drawer.
   */
  const [drill, setDrill] = useState<string | null>(null);

  if (isError) return <p className="text-base text-state-halt-ink">Readout unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the readout…</p>;

  const rate = data.catch_rate;

  return (
    <div className="flex flex-col gap-8">
      <Eyebrow variant="screen">Readout</Eyebrow>

      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">Catch rate</Eyebrow>
        </CardHeader>
        <CardBody>
          <p data-testid="catch-rate" className="font-mono text-5xl font-semibold text-ink-primary">
            {rate === null ? "—" : `${Math.round(rate * 100)}%`}
          </p>
          <p className="mt-2 text-base text-ink-secondary">
            n = {data.probes_planted ?? 0} probes this week ·{" "}
            {data.probes_caught ?? 0} caught
          </p>
          <p className="mt-4 text-xs text-ink-muted">
            The only number on this page that measures the system end to end.
            Which fields carry a probe is deliberately not shown.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">Corrections by source</Eyebrow>
        </CardHeader>
        <CardBody className="p-0">
          <ul>
            {(data.correction_by_source ?? []).map((row) => (
              <li key={row.source} className="border-t border-line-subtle first:border-t-0">
                <button
                  type="button"
                  onClick={() => setDrill(`source:${row.source}`)}
                  className="flex w-full flex-wrap items-baseline gap-5 px-8 py-5 text-left"
                >
                  <span className="w-32 font-mono text-md text-ink-primary">{row.source}</span>
                  <span className="font-mono text-base text-ink-primary">
                    {(row.correction_rate * 100).toFixed(1)}% of {row.n}
                  </span>
                  {row.alarm ? <Chip tone="halt" size="micro" bordered>look</Chip> : null}
                  {row.note ? (
                    <span className="flex-1 text-xs text-ink-secondary">{row.note}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">Fields most often corrected</Eyebrow>
        </CardHeader>
        <CardBody className="p-0">
          <ul>
            {(data.field_backlog ?? []).map((row) => (
              <li key={row.path} className="border-t border-line-subtle first:border-t-0">
                <button
                  type="button"
                  data-testid={`backlog-${row.path}`}
                  onClick={() => setDrill(`field:${row.path}`)}
                  className="flex w-full flex-wrap items-baseline gap-5 px-8 py-5 text-left"
                >
                  <span className="flex-1 font-mono text-base text-ink-primary">{row.path}</span>
                  <span className="font-mono text-base text-ink-secondary">
                    {(row.correction_rate * 100).toFixed(0)}% of {row.n}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {drill !== null ? <DrillDrawer signal={drill} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}
