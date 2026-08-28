import { useRef, useState } from "react";
import type { DeliveryWithReport } from "@titlepipe/contract";
import { Alert, Button, Card, CardBody, CardHeader, Label, Textarea } from "../../components/ui";
import { notify } from "../../shared/notify";
import { reissueHold, useReissue } from "./useReissue";

/**
 * REISSUE GATEWAY (Law 9) — the act that supersedes a delivered version.
 *
 * The reason is FREE TEXT, not the prototype's three radio buttons. A fixed
 * list would be this screen's vocabulary going onto an audit record as though
 * the pipeline had defined it; `ReissueRequest` asks for a sentence, so the
 * reviewer writes the sentence.
 */
export function ReissueGateway({
  deliveries,
}: {
  readonly deliveries: readonly DeliveryWithReport[];
}) {
  const target = latest(deliveries);
  if (target === null) return null;
  return <Gateway delivery={target} />;
}

function Gateway({ delivery }: { readonly delivery: DeliveryWithReport }) {
  const [reason, setReason] = useState("");
  const reissue = useReissue(delivery.id);
  /* `isPending` is a render away, and three clicks in one tick beat it. The
     latch closes on the click itself. */
  const filing = useRef(false);
  const held = reissueHold(reason, reissue.isPending);
  const version = delivery.report?.version ?? null;

  return (
    <Card padding="none">
      <CardHeader>
        <span>Reissue gateway (Law 9)</span>
        <span className="font-mono text-label leading-flat font-semibold text-ink-muted">
          {version === null ? "no version on this row" : `v${String(version)} immutable`}
        </span>
      </CardHeader>
      <CardBody className="flex flex-col gap-8">
        <p className="font-sans text-meta leading-body text-ink-secondary">
          Delivered reports are immutable records. Reissuing generates a
          certified new version with a stated reason, preserving full audit
          history for the lender.
        </p>

        {reissue.isError && reissue.error !== null && (
          <div data-testid="reissue-refusal">
            {/* The server's words, unedited and undismissable. */}
            <Alert tone="halt" title="Refused" message={reissue.error.message} />
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Label htmlFor="reissue-reason">
            The reason this reissue states
          </Label>
          <Textarea
            id="reissue-reason"
            data-testid="reissue-reason"
            aria-label="The reason this reissue states"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
          <p className="font-sans text-label leading-body text-ink-muted">
            The prototype offers three fixed reasons. They are not drawn: the
            pipeline defines no reason vocabulary, so a list would put this
            screen's words on the lender's record instead of yours.
          </p>
        </div>

        <Button
          variant="primary"
          data-testid="reissue-submit"
          disabledBecause={held}
          onPress={() => {
            if (filing.current) return;
            filing.current = true;
            reissue.mutate(reason, {
              onSuccess: (result) => {
                setReason("");
                notify.success(
                  `Reissued — v${String(result.report.version)} supersedes v${String(result.supersedes)}.`,
                );
              },
              onSettled: () => {
                filing.current = false;
              },
            });
          }}
        >
          {held === null ? "File the reissue" : held}
        </Button>

        {held !== null && (
          /* Rule 9 on screen, not only on hover: the reason a control is dead. */
          <p
            data-testid="reissue-hold"
            className="font-sans text-meta leading-body text-ink-secondary"
          >
            {held}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/** The row the reissue would supersede: the highest version the server returned. */
function latest(
  rows: readonly DeliveryWithReport[],
): DeliveryWithReport | null {
  return rows.reduce<DeliveryWithReport | null>(
    (best, row) =>
      best === null || (row.report?.version ?? 0) > (best.report?.version ?? 0)
        ? row
        : best,
    null,
  );
}
