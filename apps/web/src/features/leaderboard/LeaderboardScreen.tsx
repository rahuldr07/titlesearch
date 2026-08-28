import { useState } from "react";
import { Segment, SegmentedControl } from "../../components/ui";
import { EngineReadings } from "./EngineReadings";
import { EngineRoster } from "./EngineRoster";
import { SeatPane } from "./SeatPane";

/** Which of the three reads is on screen. Three panes, three endpoints. */
type EngineView = "readings" | "roster" | "seats";

function isView(key: unknown): key is EngineView {
  return key === "readings" || key === "roster" || key === "seats";
}

/**
 * ENGINES, at `/leaderboard` (`authz.ts:75`, `screen.leaderboard.enter`,
 * ENGINEER + ADMIN). The route is named for the endpoint; the screen is named
 * for its subject, and the difference matters — see below.
 *
 * ══ IT IS NOT A LEAGUE TABLE ═══════════════════════════════════════════════
 *
 * `entities.ts:271-274`: "There is deliberately no aggregate/headline accuracy
 * schema in this contract." AGENTS.md bans an aggregate accuracy headline
 * outright. So this screen has no winner, no rank column, no overall score per
 * engine and no sortable header — a table a reader can sort by accuracy is a
 * ranking device, and a ranking is a headline drawn one row at a time. Rows
 * appear in the server's order.
 *
 * Nothing here averages `accuracy_by_tag` into a per-engine figure, and the
 * reason is not squeamishness: an engine's readings span jurisdictions and
 * sections whose golden coverage differs by an order of magnitude, so a mean
 * over them is a number with no denominator anybody could name.
 *
 * ══ AND NOTHING HERE RETUNES ANYTHING ══════════════════════════════════════
 *
 * AGENTS.md: "no auto-tuning". A measurement and a seat are shown on this
 * screen and are never joined — no "promote the winner", no suggestion, no
 * highlight of the engine that scored best in a cell it does not sit in. A seat
 * change is an explicit human act with a signature and an evidence link, and
 * `SeatChange` is where the screen says so.
 *
 * ══ COST AND LATENCY ARE FACTS ABOUT A CALL ════════════════════════════════
 *
 * `cost_per_1k_pages_usd` and `p95_latency_ms` are shown, and they are not the
 * banned kind of number. INVARIANT 23 bans PACE — a rate at which people or the
 * shop get through work. A price per thousand pages and a 95th-percentile
 * response time are properties of an engine call that the contract records per
 * call by design (AGENTS.md: "cost + latency recorded per call"). There is no
 * per-hour figure, no throughput, no timer and no estimate anywhere here.
 *
 * ══ AND NO PROBES ══════════════════════════════════════════════════════════
 *
 * `/api/metrics` is not read by this screen and has no descriptor in
 * `shared/engineQueries.ts`. It carries `probes_planted`, `probes_caught` and
 * `catch_rate`; AGENTS.md bans probe visibility.
 *
 * ══ THE VIEW LIVES IN COMPONENT STATE, AND THAT IS A COMPROMISE ════════════
 *
 * `AccountScreen` puts its pane in the URL (`?tab=`) so a pane is a link. That
 * is better and is not available here: the search schema belongs to
 * `app/routeTree.tsx`, which this work does not own. When the route is wired,
 * moving this to a search param is a five-line change and the panes become
 * addressable.
 */
export function LeaderboardScreen() {
  const [view, setView] = useState<EngineView>("readings");

  return (
    <div className="tp-screen-enter flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex flex-col gap-6 px-16 pt-14 pb-8">
        <h1 className="text-title font-semibold leading-tight text-ink-primary">
          Engines
        </h1>
        <p className="max-w-400 text-meta leading-body text-ink-secondary">
          What each engine declares about itself, what it read against the
          golden set per section and jurisdiction, and which seat it currently
          holds. The three are separate records and this screen never joins
          them: a seat is changed by a person, with evidence, and never by a
          score.
        </p>
        {/* A wrapper so the group keeps its content width: it is `inline-flex`,
            and a bare flex child of this column would stretch edge to edge. */}
        <div>
          <SegmentedControl
            label="Which engine record to show"
            selectedKeys={new Set([view])}
            onSelectionChange={(keys) => {
              const [first] = keys;
              if (isView(first)) setView(first);
            }}
          >
            <Segment id="readings">Readings</Segment>
            <Segment id="roster">Declared roster</Segment>
            <Segment id="seats">Seats</Segment>
          </SegmentedControl>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-16 pb-14">
        {view === "readings" && <EngineReadings />}
        {view === "roster" && <EngineRoster />}
        {view === "seats" && <SeatPane />}
      </div>
    </div>
  );
}
