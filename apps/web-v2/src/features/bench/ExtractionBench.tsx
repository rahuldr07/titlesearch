import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { benchResultsQuery } from "./queries";
import { RuleContext } from "./RuleContext";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";

/**
 * EXTRACTION BENCH — the prompt, its rule context, and what it got wrong.
 *
 * THERE IS NO AUTO-TUNE AFFORDANCE (`bench.spec` #3), and its absence is the
 * feature. A button that optimises a prompt against a scoreboard produces a
 * prompt nobody understands, fitted to a seed set that is itself 3-of-7
 * defective in places. The loop this screen supports is a human reading why the
 * model was wrong; the copy says so, and it is prose, never a control.
 *
 * NO AGGREGATE HEADLINE either — "94% across all fields" hides the one field at
 * 30% that ships defects.
 */
export function ExtractionBench() {
  const { data } = useQuery(benchResultsQuery);
  const misses = data?.sections.find((s) => s.section === "mortgages")?.fails ?? [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-baseline gap-5">
        <Eyebrow variant="screen">Extraction bench</Eyebrow>
        <Link to="/bench/results" className="text-xs font-semibold text-action underline">
          bench results →
        </Link>
      </header>

      <Card>
        <CardBody className="flex flex-col gap-6">
          <RuleContext />
          <div className="flex flex-wrap items-center gap-5">
            <Button disabled>Run — no endpoint yet</Button>
            <span className="text-xs text-ink-muted">
              CONTRACT GAP: there is no bench-run endpoint. The prompt pane, the
              per-call cost line and the cross-package grid have no shape in the
              contract and are not drawn from invented numbers.
            </span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">Output vs truth — where this prompt missed</Eyebrow>
        </CardHeader>
        <CardBody className="p-0">
          {misses.length === 0 ? (
            <p className="px-8 py-5 text-xs text-ink-muted">
              Nothing missed in this section on the last run.
            </p>
          ) : (
            <ul>
              {misses.map((row) => (
                <li
                  key={row.path}
                  className="grid gap-2 border-t border-line-subtle px-8 py-5 first:border-t-0 sm:grid-cols-[14rem_1fr]"
                >
                  <span className="font-mono text-xs text-ink-primary">{row.path}</span>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs text-ink-primary">
                      model {row.model_value ?? "∅"} · seed {row.seed_value ?? "∅"}
                    </span>
                    <span className="text-xs leading-body text-ink-secondary">
                      {row.source_note ?? "no source note recorded"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="max-w-3xl text-xs leading-body text-ink-muted">
        No aggregate headline on purpose — one number across all fields hides the
        one field at 30% that ships defects. And no auto-tune: the loop is a
        human understanding why the model was wrong, which is not a thing a
        button can do for you.
      </p>
    </div>
  );
}
