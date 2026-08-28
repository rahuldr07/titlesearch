import { useRead } from "../../app/useRead";
import { benchResults } from "../../shared/benchQueries";
import { QueryState } from "../../entities/state/QueryState";
import { BenchResults } from "./BenchResults";
import { RelatedDoor } from "../../app/chrome/RelatedDoor";

/**
 * BENCH, at `/bench` (`authz.ts:74`, `screen.bench.enter`, ENGINEER + ADMIN).
 *
 * One read, `GET /api/bench/results`, and the whole screen is its two axes.
 *
 * ══ THE SHAPE HAS NO HEADLINE AND NEITHER DOES THE SCREEN ══════════════════
 *
 * `endpoints.ts:336-339` is unusually explicit for a schema comment: "The two
 * axes are the finding; there is deliberately NO aggregate number in this
 * shape." AGENTS.md lists "no aggregate accuracy headline" among the
 * anti-patterns whose reintroduction is "a design defect, not a feature
 * request", and this is the screen it was written about — a bench run is
 * exactly where somebody reaches for one number to put at the top.
 *
 * So nothing here divides, averages or totals. `total_fields` and `orders` are
 * printed because the SERVER sent them and they are a census of the run's
 * scope, not a score. Every cell prints `passed` and `fields` as the two
 * integers the server sent, side by side and un-collapsed. A single ratio is
 * not merely omitted from the layout — there is no arithmetic anywhere in this
 * directory that could produce one.
 *
 * ══ AND NO PROBES ══════════════════════════════════════════════════════════
 *
 * `/api/metrics` carries `probes_planted`, `probes_caught` and `catch_rate`,
 * and is the natural second read for a screen about whether the machine is
 * right. It is not read here and there is no descriptor for it in
 * `shared/benchQueries.ts`. AGENTS.md: "no probe visibility." A planted probe
 * a reviewer can see is not a probe.
 *
 * ══ NO PACE, EITHER ════════════════════════════════════════════════════════
 *
 * INVARIANT 23 bans pace indicators, throughput language, timers and time
 * ESTIMATES. A bench run has a duration and this screen does not ask for one:
 * the contract carries no run timing, and if it did, the figure would still be
 * a rate about people and machines rather than a fact about a field.
 *
 * ══ THE FRAME ══════════════════════════════════════════════════════════════
 *
 * INVARIANT 60: the app is ONE FRAME and only a screen body scrolls. This
 * screen's two panes each own a scroll (the matrix's virtualized container and
 * the section list), which is the workstation arrangement the kit already
 * supports; the page itself never scrolls and the heading never moves.
 */
export function BenchScreen() {
  const results = useRead(benchResults);

  return (
    <div className="tp-screen-enter flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex flex-col gap-4 px-16 pt-14 pb-8">
        <h1 className="text-title font-semibold leading-tight text-ink-primary">
          Bench
        </h1>
        <p className="max-w-400 text-meta leading-body text-ink-secondary">
          Every extracted field of this run set against the golden seed, split
          two ways: by report section, and by how the seed value earned its
          authority. The run states passes and fields separately and this screen
          keeps them separate.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-16 pb-14">
        <QueryState query={results} of="the bench run">
          {(data) => <BenchResults results={data} />}
        </QueryState>
      </div>
      <RelatedDoor to="/golden">The golden set every cell is scored against →</RelatedDoor>
    </div>
  );
}
