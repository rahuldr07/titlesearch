import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Engine,
  EngineRoutingCell,
  EngineRoutingRequest,
} from "@titlepipe/contract";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";
import { Alert, Button, Card } from "../../components/ui";
import { SeatFields } from "./SeatFields";
import { seatHold } from "./seatHold";

/**
 * A SEAT CHANGE — AN ENGINEER'S ACT, WITH EVIDENCE, AND NOTHING ELSE.
 *
 * Four named inputs and one button. No suggestion, no default engine, no
 * "recommended" mark, nothing pre-selected from the readings pane. AGENTS.md
 * bans auto-tuning; a form that arrives with the highest-scoring engine already
 * chosen is auto-tuning with a human's finger on it, and the evidence field
 * would then be documenting the layout's opinion rather than the person's.
 *
 * ══ THE REFUSAL IS CARRIED IN THREE PLACES, ON PURPOSE ═════════════════════
 *
 *   - the SERVER refuses (`handlers.ts:1257`) — the only enforcement, and it
 *     also role-gates on `routing.flip` before it validates anything;
 *   - the request TYPE is the contract's `EngineRoutingRequest`, whose
 *     `evidence_url` is `z.string().min(1)`, so an evidence-free call is a
 *     compile error here before it is a 422 there;
 *   - `seatHold` states the hold in words while the button is dead, because a
 *     control that is merely inert teaches nobody why.
 *
 * ══ THE SERVER'S SENTENCE, VERBATIM ════════════════════════════════════════
 *
 * INVARIANT 14. On a refusal the mutation's error message is rendered unedited
 * by `Alert` (a `string`, so nothing can be composed into it) and repeated by
 * `notify`. This component authors the word "Refused" — which names the region
 * — and not one word of the reason.
 *
 * ══ ONE ACT FILES ONE RECORD ═══════════════════════════════════════════════
 *
 * INVARIANT 20. `seatHold` returns a reason while `isPending`, so the button is
 * disabled for the whole flight and three clicks file one change. There is no
 * optimistic paint (INVARIANT 4): on success the routing query is invalidated
 * and the SERVER's row repaints with its new `approved_by` and `approved_at`.
 * Those two fields are the receipt, and they are the server's to write — the
 * client does not post a name, and a signature the client could type would not
 * be a signature.
 */
export function SeatChange({
  cells,
  engines,
}: {
  readonly cells: readonly EngineRoutingCell[];
  readonly engines: readonly Engine[];
}) {
  const [cellId, setCellId] = useState<string | null>(null);
  const [engineId, setEngineId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const client = useQueryClient();

  const change = useMutation({
    mutationFn: (body: EngineRoutingRequest) => post("/api/engines/routing", Ack, body),
    /*
     * NOTHING IS CLEARED AND NOTHING IS PAINTED. The routing query is
     * invalidated and the SERVER's row comes back with its new `engine_id`,
     * `approved_by` and `approved_at` (INVARIANT 4 — never an optimistic local
     * mutation). The form then holds itself, because `seatHold` sees the seat
     * already holding the chosen engine: the act is filed, so filing it again
     * is refused in words. That refusal IS the receipt.
     *
     * Clearing the evidence field was tried and is wrong twice over: the kit's
     * `Input` is uncontrolled, so resetting the state leaves the typed text on
     * screen under a button claiming the citation is missing — and the citation
     * is worth keeping visible beside the row it just wrote.
     */
    onSuccess: () => client.invalidateQueries({ queryKey: ["engines", "routing"] }),
    onError: (error: Error) => notify.error(error.message),
  });

  const seat = cells.find((cell) => cell.id === cellId) ?? null;
  /* Only engines the roster declares enabled. Seating a withdrawn adapter seats
     something that will not run — the same filter, and the same reasoning, as
     `ResolveCard` citing only `live` rules. The server remains the authority. */
  const seatable = engines.filter((engine) => engine.enabled);
  const held = seatHold(seat, engineId, evidence, change.isPending);

  return (
    <Card>
      <div className="flex flex-col gap-8">
        <p className="text-meta leading-body text-ink-secondary">
          Changing a seat is a decision somebody signs. It is refused without a
          citation, and the record keeps who made it and what they cited.
        </p>

        <SeatFields
          cells={cells}
          engines={seatable}
          seat={seat}
          cellId={cellId}
          engineId={engineId}
          onCell={setCellId}
          onEngine={setEngineId}
          onEvidence={setEvidence}
        />

        {change.isError && <Alert tone="halt" title="Refused" message={change.error.message} />}

        <Button
          variant="primary"
          disabledBecause={held}
          onPress={() => {
            if (seat === null || engineId === null) return;
            change.mutate({
              jurisdiction: seat.jurisdiction,
              section: seat.section,
              seat: seat.seat,
              engine_id: engineId,
              evidence_url: evidence,
            });
          }}
        >
          {held === null ? "File the seat change" : "Seat change — held"}
        </Button>
      </div>
    </Card>
  );
}

/**
 * The mock's `{ ok: true }` acknowledgement, as a structural validator rather
 * than a zod schema — `shared/api.ts` takes `Validator<T>` and this app never
 * imports zod into the browser bundle. The response carries no state; the
 * invalidated query does.
 */
const Ack = {
  safeParse: (input: unknown) =>
    ({ success: true, data: input }) as { success: true; data: unknown },
};
