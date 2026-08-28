import { useMutation } from "@tanstack/react-query";
import { BlindEntriesResponse, type BlindEntriesRequest } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { blindEntriesPath } from "../../shared/blindQueries";
import { notify } from "../../shared/notify";

/**
 * THE SEAT'S ONE MUTATION, AND IT IS THE SEAT'S ONLY SERVER CALL OF ANY KIND.
 *
 * `POST /api/blind/{order}/entries` (endpoints.ts:295-307). The request type is
 * the CONTRACT'S — `BlindEntriesRequest` — for the reason `useEscalations`
 * records: a shape spelled locally is a shape that can drift, and here the
 * drift would be silent, because the thing that would go wrong is a
 * measurement rather than a screen.
 *
 * ══ NOTHING IS INVALIDATED, AND THAT IS NOT AN OMISSION ════════════════════
 *
 * Every other mutation in this app ends with `invalidateQueries`, because the
 * server's repainted state is the truth (INVARIANT 4). There is no query to
 * invalidate here: no read of blind entries exists, by design
 * (endpoints.ts:290-294), so the accepted `entry_ids` the server hands back
 * ARE the entire record the seat is allowed to see. They are printed verbatim
 * and nothing is re-fetched.
 *
 * ══ ONE ACT FILES ONE RECORD ═══════════════════════════════════════════════
 *
 * INVARIANT 20/21. The submit control is disabled while `isPending`, so three
 * clicks — including three inside one tick, since react-aria will not fire
 * `onPress` on a disabled button — file one entry set. There is no debounce
 * anywhere near this: a timer is a race with a different shape.
 *
 * ══ A REFUSAL SPEAKS TWICE, IN THE SERVER'S WORDS BOTH TIMES ═══════════════
 *
 * INVARIANT 14/16. `shared/api.ts` carries the server's sentence onto the
 * `ApiError` verbatim; the toast shows it and the screen keeps it on the page,
 * because a 409 is an ANSWER and a toast that has faded is an answer nobody
 * can re-read. Neither layer composes a word of it.
 */
export function useCapture(order: string, onAccepted: () => void) {
  return useMutation({
    mutationFn: (body: BlindEntriesRequest) =>
      post(blindEntriesPath(order), BlindEntriesResponse, body),
    onSuccess: onAccepted,
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}
