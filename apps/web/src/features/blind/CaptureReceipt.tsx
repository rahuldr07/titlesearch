import type { BlindEntriesResponse } from "@titlepipe/contract";
import { Alert, Card } from "../../components/ui";

/**
 * What came back: a refusal in the server's words (INVARIANT 14 — verbatim,
 * kept on the page rather than in a toast), or the ids the server issued. The
 * ack carries nothing else, because the response shape carries nothing else.
 */
export function CaptureReceipt(props: {
  readonly error: Error | null;
  readonly accepted: BlindEntriesResponse | undefined;
}) {
  if (props.error !== null) {
    return (
      <Alert
        tone="halt"
        title="Refused"
        message={props.error.message}
        className="tp-screen-enter"
      />
    );
  }

  if (props.accepted === undefined) return null;

  return (
    <Card>
      <div data-testid="capture-ack" className="flex flex-col gap-5">
        <span className="text-label font-semibold leading-flat text-state-settled">
          Filed
        </span>
        <p className="font-mono text-meta leading-close text-ink-primary">
          {props.accepted.entry_ids.join(" · ")}
        </p>
        <p className="text-meta leading-body text-ink-secondary">
          These ids are the whole of what this seat is told. The server does not
          return what it did with the entries, what the machine read, or what the
          other seat keyed — that silence is the measurement, not a missing
          screen.
        </p>
      </div>
    </Card>
  );
}
