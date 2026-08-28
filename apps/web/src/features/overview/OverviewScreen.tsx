import { Link } from "@tanstack/react-router";
import { useRead } from "../../app/useRead";
import { lifecycle, queueNext } from "../../shared/queries";
import { useSignedIn } from "../../app/session/signedIn";
import { usePermissions } from "../../app/session/permissions";
import { Card } from "../../components/ui";
import { OverviewHeader } from "./OverviewHeader";
import { StatCard } from "./StatCard";
import { RecentOrders } from "./RecentOrders";
import { Spotlight } from "./Spotlight";
import { CENSUS_FIGURES } from "../../entities/lifecycle/census";

/**
 * SCREEN 2 — OVERVIEW, at `/` (`authz.ts:62`, `screen.home.enter`, SIGHTED).
 * Typists never see it: they go straight to the capture seat (§0.7).
 */
export function OverviewScreen() {
  const account = useSignedIn((s) => s.account);
  const permissions = usePermissions(account !== null);

  const board = useRead(lifecycle);
  const served = useRead(queueNext);

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

      {/* The four labels and tones come from `entities/lifecycle/census`, which
          the lifecycle board reads too — one variable, never two literals. */}
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

      <Spotlight
        order={served.data?.order ?? null}
        pending={served.isPending}
        failed={served.isError}
      />

      <RecentOrders />

      {/* The board's own stage rows are the lifecycle screen's subject, not this
          one's. The link is the join. */}
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
