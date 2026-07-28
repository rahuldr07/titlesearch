import { Card, CardBody } from "../../shared/ui/Card";
import { buttonClasses } from "../../shared/ui/Button";

/**
 * The Clients tab is a DOOR, not a second copy of the clients screen.
 *
 * Client overrides only mean anything read against a product baseline, and the
 * clients screen already draws that resolution — baseline behind, deltas on
 * top, conflicts called out. Rebuilding a thinner version of it here would give
 * the same question two answers that are free to drift, which is the failure
 * this whole layer is arranged to avoid.
 *
 * The tab exists at all because this is where someone looks for clients. Absent
 * would read as "clients are not configurable"; a door reads as "not here,
 * there".
 */
export function ClientsLink() {
  return (
    <Card>
      <CardBody className="p-10 text-center">
        <p className="font-semibold text-ink-primary">
          Clients &amp; overrides live on their own screen
        </p>
        <p className="mt-2 text-sm leading-body text-ink-secondary">
          Add clients, set sign-off defaults, and author overrides against the
          baseline.
        </p>
        {/*
          A plain anchor, not a typed <Link>: `/clients` is registered by whoever
          owns the router, and a typed link to an unregistered route does not
          compile. Swap this for <Link to="/clients"> once the route is wired —
          the anchor costs a full reload, which is the only thing wrong with it.
        */}
        <a
          href="/clients"
          data-testid="open-clients"
          className={`${buttonClasses({ size: "lg" })} mt-7`}
        >
          Open Clients →
        </a>
      </CardBody>
    </Card>
  );
}
