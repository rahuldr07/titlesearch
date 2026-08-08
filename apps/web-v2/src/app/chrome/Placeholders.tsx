import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * A wrong address gets a NAMED state, never a blank page (`errors.spec` #1).
 * A blank page is indistinguishable from a screen that loaded and found
 * nothing, and in this product those mean opposite things.
 */
export function NotFound() {
  return (
    <Card size="emphasis" accent="halt">
      <CardBody>
        <Eyebrow variant="screen" tone="halt">Not found</Eyebrow>
        <p data-testid="not-found" className="mt-4 text-md text-ink-primary">
          Nothing lives at this address.
        </p>
        <p className="mt-3 text-base text-ink-secondary">
          Press <span className="font-mono">?</span> for the map of where you can go.
        </p>
      </CardBody>
    </Card>
  );
}
