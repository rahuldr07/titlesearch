import { Card, CardBody } from "../shared/ui/Card";
import { Eyebrow } from "../shared/ui/Eyebrow";

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

/**
 * A door that exists in the role's world but whose screen is not built.
 *
 * It states WHY rather than showing an empty shell — the same reasoning as
 * ScreenFailure. Someone landing here should be able to tell "not written yet"
 * from "written, and there is nothing to show you", because only one of those
 * is a reason to go and ask somebody.
 */
export function NotBuiltYet({ why }: { why: string }) {
  return (
    <Card size="emphasis" accent="attend">
      <CardBody>
        <Eyebrow variant="screen" tone="attend">Not built yet</Eyebrow>
        <p className="mt-4 text-base leading-body text-ink-secondary">{why}</p>
      </CardBody>
    </Card>
  );
}
