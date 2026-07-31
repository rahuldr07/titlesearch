import { ApiError } from "../../shared/api";

/**
 * One submitted write, reduced to the two things a refusal is made of. Every
 * `useMutation` result satisfies this structurally, so nothing has to be
 * unpacked at the call site and this stays testable without React.
 */
export interface WriteOutcome {
  readonly error: Error | null;
  /** `0` until the mutation has been fired at least once (react-query). */
  readonly submittedAt: number;
}

/**
 * WHAT THE SERVER SAID ABOUT THE LAST THING THE REVIEWER DID.
 *
 * HANDOFF §4 rule 9: a 409 is an ANSWER and must render with the server's
 * message VERBATIM. That is a property of a WRITE, not of one endpoint — the
 * screen used to read `confirm.error` alone, so refusals on `/correct`,
 * `/escalate`, `/exclude` and `/pass` reached nothing at all: no note, no
 * alert, the editor still open holding a value the server had rejected.
 *
 * THE MOST RECENT SUBMISSION WINS, rather than the first error found. A
 * mutation keeps its error until it is fired again, so scanning for "any error"
 * would keep showing a refusal the reviewer has since worked past — a false
 * claim about the decision they just made, which is the same defect in the
 * other direction.
 *
 * ONLY THE SERVER'S OWN WORDS. A `TypeError: Failed to fetch` is a client-side
 * failure; printing it under `server:` would put a sentence in the server's
 * mouth that it never said. Transport failures belong to the error boundary
 * (`errors.spec` #2), not to this line.
 */
export function latestRefusal(writes: readonly WriteOutcome[]): string | null {
  let latest: WriteOutcome | null = null;
  for (const write of writes) {
    if (write.submittedAt === 0) continue;
    if (latest === null || write.submittedAt > latest.submittedAt) latest = write;
  }
  return latest !== null && latest.error instanceof ApiError ? latest.error.message : null;
}
