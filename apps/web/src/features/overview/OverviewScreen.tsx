import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { get } from "../../shared/api";
import { lifecycle, queueNext } from "../../shared/queries";
import { useSignedIn } from "../../app/session/signedIn";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { StatCard } from "./StatCard";
import { Spotlight } from "./Spotlight";

/**
 * SCREEN 2 — OVERVIEW, at `/` (`authz.ts:62`, `screen.home.enter`, SIGHTED).
 *
 * Typists never see it: they go straight to the capture seat (§0.7), which is
 * why `SIGHTED` excludes them and why this screen never has to remember to.
 *
 * ══ THE FOUR STAT CARDS ARE THE SERVER'S FOUR NUMBERS ══════════════════════
 *
 * Design §Screens 2 asks for "4 stat cards (label 11px grey, value 28px, note
 * 13px — NO INVENTED METRICS)" and names none of them. `LifecycleResponse`
 * (`intake.ts:246`) carries exactly four top-level figures — `total`, `halted`,
 * `moving`, `failed` — each decided on the server, so the count and the card
 * are one to one and nothing is added up here.
 *
 * `/api/metrics` is deliberately NOT read on this screen, and the reason is not
 * that it is the dashboard's endpoint. It carries `median_minutes_per_order`,
 * which is a PACE INDICATOR: `INVARIANTS:84-85` bans them, AGENTS.md bans
 * throughput counters "anywhere", and a stat card is the most likely place in
 * the product for one to end up. The lifecycle figures are a census of WHAT IS
 * LEFT — endpoints.ts:99 states the distinction outright, "a count of what is
 * left, never a rate" — which is the only shape of number this screen may draw.
 *
 * `scope_note` is printed verbatim beside them because the numbers mean
 * different things to different seats: a reviewer's board is scoped to their
 * own orders plus anything unclaimed, and the census is not scoped at all. The
 * server says which; the screen does not compose that sentence.
 *
 * ══ THE RECENT ORDERS TABLE IS NOT BUILT ═══════════════════════════════════
 *
 * Design §Screens 2, verbatim: "Recent orders table (last 10) linking to All
 * Orders." There is NO ORDER-LIST ENDPOINT — `endpoints.ts:69` says so in
 * words, `INVARIANTS:82-83` forbids one, and the screen it links to is the
 * conflict recorded in `CONFLICT-all-orders.md`. A "last 10" is a browse
 * affordance with a smaller number on it. Refused, and the pane below says so
 * rather than leaving a hole a reader reads as a loading failure.
 */
export function OverviewScreen() {
  const account = useSignedIn((s) => s.account);

  const board = useQuery({
    queryKey: lifecycle.key,
    queryFn: () => get(lifecycle.path, lifecycle.schema),
  });

  const served = useQuery({
    queryKey: queueNext.key,
    queryFn: () => get(queueNext.path, queueNext.schema),
  });

  return (
    <div className="tp-screen-enter flex h-full min-h-0 flex-col gap-10 overflow-y-auto p-14">
      <header className="flex flex-col gap-2">
        <span className="text-label font-semibold uppercase leading-flat tracking-caps text-ink-faint">
          Overview
        </span>
        {/* The greeting names the reader and claims nothing else. The design's
            time-of-day greeting is dropped: it needs a clock reading whose only
            purpose is decoration, and §8 keeps date handling to one module. */}
        <h1 className="text-title font-bold leading-tight text-ink-primary">
          {account === null ? "The shop" : account.name}
        </h1>
        {board.data !== undefined && (
          <p className="max-w-240 text-meta leading-body text-ink-secondary">
            {board.data.scope_note}
          </p>
        )}
      </header>

      {board.isError && (
        <Card>
          <p role="alert" className="text-meta leading-body text-state-halt">
            {board.error.message}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-8">
        <StatCard
          label="In the shop"
          value={board.data?.total}
          note="Every order the book knows about."
        />
        <StatCard
          label="Stopped"
          value={board.data?.halted}
          note="Waiting on a person, not on the machine."
        />
        <StatCard
          label="Moving"
          value={board.data?.moving}
          note="The machine is working on these."
        />
        <StatCard
          label="Failed"
          value={board.data?.failed}
          note="Stopped in the stage they broke in."
        />
      </div>

      <Spotlight order={served.data?.order ?? null} pending={served.isPending} />

      {/*
       * WHERE THE DESIGN'S RECENT-ORDERS TABLE WOULD HAVE BEEN. Stated, not
       * omitted: a blank region reads as a screen that failed to load, and
       * AGENTS.md forbids emitting values that cannot be cited — a plausible
       * ten-row table is exactly that.
       */}
      <Card padding="none">
        <CardHeader>Recent orders</CardHeader>
        <CardBody className="flex flex-col gap-5 py-10">
          <p className="max-w-260 text-meta leading-body text-ink-secondary">
            Not built, and not pending. The design draws the last ten orders
            here linking to a browsable table; no endpoint lists orders and the
            contract removed one by construction, so there is nothing to list
            and nowhere to link. The way to an order is the queue serving you
            one, or a deep link somebody sent you.
          </p>
          <p className="text-meta leading-body text-ink-secondary">
            The collision and the options for resolving it are written up in{" "}
            <span className="font-mono text-label text-ink-muted">
              docs/frontend/design-2026-08/CONFLICT-all-orders.md
            </span>
            .
          </p>
          <Link
            to="/queue"
            className="tp-state w-fit text-meta font-semibold leading-close text-action underline-offset-4 hover:underline"
          >
            Go to the queue
          </Link>
        </CardBody>
      </Card>

      {/* The board's own stage rows are the lifecycle screen's subject, not
          this one's — drawing them here would be two screens counting the same
          thing. The link is the join. */}
      {board.data !== undefined && board.data.stages.length > 0 && (
        <p className="text-label leading-close text-ink-faint">
          Seven stages hold these orders.{" "}
          <Link to="/dashboard" className="tp-state text-action hover:underline">
            The lifecycle board
          </Link>{" "}
          draws them.
        </p>
      )}
    </div>
  );
}
