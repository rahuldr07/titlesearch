import { useRef, useState } from "react";
import type { DeliveryWithReport } from "@titlepipe/contract";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  RadioGroup,
  RadioGroupItem,
} from "../../components/ui";
import { notify } from "../../shared/notify";
import { useReissueReasons } from "./useDeliveries";
import { reissueHold, useReissue } from "./useReissue";

/**
 * The act that supersedes a delivered version. The reason is chosen from the
 * server's canned list — the pipeline's vocabulary goes on the audit record,
 * never free text. The first option arrives pre-selected.
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
  const reasons = useReissueReasons();
  const [picked, setPicked] = useState<string | null>(null);
  const reissue = useReissue(delivery.id);
  /* `isPending` is a render away, and repeated clicks in one tick beat it —
     the latch closes on the click itself. */
  const filing = useRef(false);
  const options = reasons.data?.reasons ?? [];
  const reason = picked ?? options[0] ?? "";
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

        {options.length === 0 ? (
          <p className="font-sans text-label leading-body text-ink-muted">
            The reason vocabulary has not arrived; without it there is nothing
            to state on the record, so the act stays closed.
          </p>
        ) : (
          <RadioGroup
            aria-label="The reason this reissue states"
            value={reason}
            onChange={setPicked}
            className="flex flex-col gap-5"
            data-testid="reissue-reasons"
          >
            {options.map((option, index) => (
              <RadioGroupItem
                key={option}
                value={option}
                data-testid={`reissue-reason-${String(index)}`}
              >
                {option}
              </RadioGroupItem>
            ))}
          </RadioGroup>
        )}

        <Button
          variant="primary"
          data-testid="reissue-submit"
          disabledBecause={held}
          onPress={() => {
            if (filing.current) return;
            filing.current = true;
            reissue.mutate(reason, {
              onSuccess: (result) => {
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
          {held === null ? "Initiate certified reissue" : held}
        </Button>

        {held !== null && (
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
