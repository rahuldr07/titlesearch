import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { get } from "../../shared/api";
import { lifecycle, queueNext } from "../../shared/queries";
import { useSignedIn } from "../../app/session/signedIn";
import { usePermissions } from "../../app/session/permissions";
import { Card } from "../../components/ui";
import { OverviewHeader } from "./OverviewHeader";
import { StatCard } from "./StatCard";
import { RecentOrdersRefusal } from "./RecentOrdersRefusal";
import { Spotlight } from "./Spotlight";
import { CENSUS_FIGURES } from "../../entities/lifecycle/census";

/**
 * SCREEN 2 — OVERVIEW, at `/` (`authz.ts:62`, `screen.home.enter`, SIGHTED).
 *
 * Typists never see it: they go straight to the capture seat (§0.7), which is
 * why `SIGHTED` excludes them and why this screen never has to remember to.
 *
 * ══ REBUILT AGAINST THE RUNNING PROTOTYPE, NOT THE README ══════════════════
 *
 * The first version was written from the README's prose summary and drifted in
 * the way that guarantees: it invented its own copy ("Every order the book
 * knows about", "The machine is working on these"), titled the screen with the
 * reader's NAME, and dropped the header's whole right-hand side.
 * `reference-app.html`'s `isQueue` block is the source now, read as markup:
 *
 *     header band                                    → OverviewHeader
 *     4 stat cards, grid-cols-4, gap 16, mt 24       → StatCard
 *     Active Spotlight card, 4px accent rail, mt 24  → Spotlight
 *     "Recent orders" heading + table, mt 32         → RecentOrdersRefusal
 *     screen padding 28px 32px 64px                  → px-16 pt-14 pb-32
 *
 * Each of those four files carries the measurements it was built to and the
 * reason for anything the prototype draws that it does not.
 *
 * ══ THE FOUR STAT CARDS: THE DESIGN'S NAMES DO NOT FIT THE CONTRACT ════════
 *
 * The prototype names four cards — Total Active Queue / In Examination Review /
 * Open Queries & Gaps / Delivered This Week — and computes all four in the
 * browser by filtering a 35-row `ALL_ORDERS` array by stage.
 *
 * `LifecycleResponse` (`intake.ts:246`) carries a different four:
 * `total` / `halted` / `moving` / `failed`, each decided on the server, so the
 * count and the card are one to one and nothing is added up here. The two
 * taxonomies meet in one place and diverge everywhere else, which is a
 * `CONFLICT` in the design under `INVARIANTS:26-27`, written up with the ask
 * for the backend owner in
 * `docs/frontend/design-2026-08/CONFLICT-overview-stats.md`. It is NOT resolved
 * here in either direction: the prototype's names are not pasted over figures
 * that do not mean them, and `INVARIANTS` is not edited to make the names legal.
 *
 * The reason they cannot simply be adopted is the one `CONFLICT-all-orders.md`
 * §4 records for the hub's meter: "A meter measuring one thing under a caption
 * naming another is the defect; a meter measuring what it says is not."
 * "Delivered This Week" over an all-time delivered count is exactly that, and
 * "Total Active Queue" would need `total` minus the delivered stage — browser
 * arithmetic over a server census, which INVARIANT 5 forbids and which
 * `endpoints.ts:143-150` calls "a count nobody can audit against the pipeline".
 * So the labels name the contract member each card prints, and nothing more.
 *
 * `/api/metrics` is deliberately NOT read here, and the reason is not that it
 * is the dashboard's endpoint. It carries `median_minutes_per_order`, a PACE
 * INDICATOR: `INVARIANTS:84-85` bans them, AGENTS.md bans throughput counters
 * "anywhere", and a stat card is the most likely place in the product for one
 * to end up. The lifecycle figures are a census of WHAT IS LEFT —
 * `endpoints.ts:99` states the distinction outright, "a count of what is left,
 * never a rate" — which is the only shape of number this screen may draw.
 *
 * `/api/queue/bands` is refused as a source too, and it is the tempting one:
 * four bands, each with a server-authored `title`, `note` and `count`, which is
 * the stat card's exact shape. It is ⚠ AWAITING RATIFICATION and whether its
 * Mine band may be DRAWN AT ALL is open ruling Q11 (`endpoints.ts:99-102`).
 * AGENTS.md: do not build past `OPEN`.
 */
export function OverviewScreen() {
  const account = useSignedIn((s) => s.account);
  const permissions = usePermissions(account !== null);

  const board = useQuery({
    queryKey: lifecycle.key,
    queryFn: () => get(lifecycle.path, lifecycle.schema),
  });

  const served = useQuery({
    queryKey: queueNext.key,
    queryFn: () => get(queueNext.path, queueNext.schema),
  });

  return (
    <div className="tp-screen-enter flex h-full min-h-0 flex-col gap-12 overflow-y-auto px-16 pt-14 pb-32">
      <OverviewHeader
        scopeNote={board.data?.scope_note}
        role={account?.role}
        rules={permissions.data?.rules}
      />

      {board.isError && (
        <Card>
          <p role="alert" className="text-meta leading-body text-state-halt">
            {board.error.message}
          </p>
        </Card>
      )}

      {/*
       * The four labels and tones come from `entities/lifecycle/census`, which
       * the lifecycle board reads too. They were spelled out twice — rule 11's
       * "one variable, never two literals" — and matched only because somebody
       * matched them by hand.
       */}
      <div className="grid grid-cols-4 gap-8">
        {CENSUS_FIGURES.map((figure) => (
          <StatCard
            key={figure.member}
            label={figure.label}
            value={board.data?.[figure.member]}
            tone={figure.tone}
          />
        ))}
      </div>

      <Spotlight order={served.data?.order ?? null} pending={served.isPending} />

      <RecentOrdersRefusal />

      {/* The board's own stage rows are the lifecycle screen's subject, not
          this one's — drawing them here would be two screens counting the same
          thing. The link is the join. */}
      {board.data !== undefined && board.data.stages.length > 0 && (
        <p className="text-meta leading-close text-ink-secondary">
          Seven stages hold these orders.{" "}
          <Link
            to="/dashboard"
            className="tp-state text-action underline underline-offset-4"
          >
            The lifecycle board
          </Link>{" "}
          draws them.
        </p>
      )}
    </div>
  );
}
