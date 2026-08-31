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
 * The Overview screen, at `/`. Typists never see it: they go straight to
 * the capture seat.
 */
export function OverviewScreen() {
  const account = useSignedIn((s) => s.account);
  const permissions = usePermissions(account !== null);

  const board = useRead(lifecycle);
  const served = useRead(queueNext);

  return (
    <div className="tp-screen-enter flex h-full min-h-0 flex-col gap-12 overflow-y-auto px-16 pt-14 pb-32">
      <OverviewHeader role={account?.role} rules={permissions.data?.rules} />

      {board.isError && (
        <Card>
          <p role="alert" className="text-meta leading-body text-state-halt">
            {board.error.message}
          </p>
        </Card>
      )}

      {/* The card order and tones come from `entities/lifecycle/census`.
          Label, value and note are the server's. */}
      <div className="grid grid-cols-4 gap-8">
        {CENSUS_FIGURES.map((figure) => (
          <StatCard
            key={figure.member}
            figure={board.data?.[figure.member]}
            tone={figure.tone}
            noteTone={figure.noteTone}
          />
        ))}
      </div>

      <Spotlight
        order={served.data?.order ?? null}
        pending={served.isPending}
        failed={served.isError}
      />

      <RecentOrders />

      {/* The surface that actually holds every order is the browse table,
          so the join points there. */}
      {board.data !== undefined && board.data.stages.length > 0 && (
        <p className="text-meta leading-close text-ink-secondary">
          The pipeline&apos;s stages hold these orders.{" "}
          <Link
            to="/orders-list"
            className="tp-state text-action underline underline-offset-4"
          >
            All orders
          </Link>{" "}
          lists every one.
        </p>
      )}
    </div>
  );
}
