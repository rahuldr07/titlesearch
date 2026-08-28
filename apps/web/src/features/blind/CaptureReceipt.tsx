import type { BlindEntriesResponse } from "@titlepipe/contract";
import { Alert, Card } from "../../components/ui";

/**
 * WHAT CAME BACK — a refusal in the server's words, or the minimal ack.
 *
 * ══ THE REFUSAL IS THE SERVER'S SENTENCE, ON THE PAGE ══════════════════════
 *
 * INVARIANT 14: "a refused mutation surfaces the server's message verbatim —
 * the client never authors the refusal text." INVARIANT 16: "a 409 is an
 * ANSWER" — surfaced, not swallowed. `Alert.message` is typed `string` for
 * exactly this reason (`alert.tsx`: composing one has to be visible at the call
 * site), and what this file supplies beside it is the TITLE — "Refused", the
 * screen's name for the region — never the reason.
 *
 * It is on the page as well as in the toast because a toast that has faded is
 * an answer nobody can re-read, and a typist who has just lost a screenful of
 * keying needs to still be looking at why.
 *
 * ══ THE ACK IS THE ENTIRE RECORD THIS SEAT MAY SEE ═════════════════════════
 *
 * `BlindEntriesResponse` is `accepted: true` and `entry_ids` and nothing else
 * (endpoints.ts:303-307), and its contract note is explicit that this is a
 * design constraint rather than an oversight: the endpoint "physically cannot
 * return model output or the other seat's entries", and "widening this
 * response shape is a design defect."
 *
 * So the ids print, in mono because an id is data (rule 3), and the sentence
 * under them says the silence is the protocol. Nothing here counts them
 * against an expected total, because no expected total exists — see
 * `SeatGaps`, the capture schedule.
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
