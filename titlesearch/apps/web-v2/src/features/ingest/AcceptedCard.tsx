import { Card, CardBody } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";

/**
 * The receipt. It names the ORDER REFERENCE the client will use, not the
 * internal id — a person chasing this package tomorrow will be holding the
 * former and will never have seen the latter.
 *
 * There is no "undo". The package is in the pipeline, and a mistake is
 * corrected on the order rather than by re-uploading — which the door would
 * refuse as a duplicate anyway, correctly.
 */
export function AcceptedCard({ orderRef, onAnother }: { orderRef: string; onAnother: () => void }) {
  return (
    <Card data-testid="accepted-card" accent="action">
      <CardBody className="flex flex-col gap-4">
        <p className="text-md font-semibold text-state-settled-ink">
          Signed for. Order {orderRef} is queued.
        </p>
        <p className="max-w-2xl text-base leading-body text-ink-secondary">
          The package is in the pipeline. Nothing on this screen can change that
          — a mistake here is corrected on the order, not by re-uploading.
        </p>
        <div>
          <Button size="sm" fill="outlined" tone="neutral" onClick={onAnother}>
            ingest another
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
