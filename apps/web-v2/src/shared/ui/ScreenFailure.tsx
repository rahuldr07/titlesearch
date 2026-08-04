import { Card, CardBody } from "./Card";
import { Eyebrow } from "./Eyebrow";

/**
 * The error boundary card. Copy is the DESIGN'S OWN, verbatim, and it should
 * stay that way — it is harvested orphan rule **O6** independently rediscovered
 * by the designer and stated better than the rulebook states it:
 *
 *   "so it isn't showing you anything, rather than showing a blank that could
 *    be mistaken for real configuration"
 *
 * That sentence is the whole rule. A screen that fails half-way and renders an
 * empty region looks identical to a screen that succeeded and found nothing —
 * and in this product those two mean opposite things. Never a silent blank.
 *
 * Wrap any screen whose view-model can throw.
 */
export function ScreenFailure({
  /** Shown only to help someone report it. Never a stack trace. */
  reference,
}: {
  reference?: string | undefined;
}) {
  return (
    <Card size="emphasis" accent="halt">
      <CardBody>
        <Eyebrow variant="screen" tone="halt">
          This screen did not load
        </Eyebrow>
        <p className="mt-4 text-md text-ink-primary">
          Something went wrong building this screen — so it isn&rsquo;t showing you
          anything, rather than showing a blank that could be mistaken for real
          configuration.
        </p>
        <p className="mt-3 text-base font-semibold text-ink-primary">
          Your data is unchanged.
        </p>
        {reference ? (
          <p className="mt-6 font-mono text-xs text-ink-muted">
            <span className="sr-only">Reference for reporting this: </span>
            {reference}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
