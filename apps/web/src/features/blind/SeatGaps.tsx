import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * WHAT THE SEAT CANNOT BE TOLD, AND WHY EACH SILENCE IS DIFFERENT.
 *
 * Two of these three are ABSENCES IN THE CONTRACT and one is a REFUSAL, and
 * collapsing them would be the worst thing this file could do:
 *
 *   - the capture schedule and the seat label are missing shapes. Somebody has
 *     to add them, and the ask is cited below.
 *   - the read-back is missing ON PURPOSE. `endpoints.ts:290-294` says
 *     "widening this response shape is a design defect", so it is stated at
 *     the bottom of the form as a property of the protocol rather than as a
 *     gap — a `ContractGap` there would read as a to-do item, and the next
 *     person would close it.
 *
 * Root AGENTS.md forbids drawing either kind with plausible contents: "never
 * generate backend logic from the UI/screens", "never emit a value you can't
 * cite". A schedule of invented field paths is the sharpest case on this
 * screen, because a typist would key exactly the fields it listed.
 */
export function SeatGaps() {
  return (
    <div className="flex flex-col gap-8">
      <ContractGap
        drawn="The capture schedule — the list of fields this package is to be keyed against, so a typist works a fixed sheet rather than typing paths from memory"
        has={
          <>
            Nothing. `BlindEntryInput.path` (entities.ts:289-296) is a bare
            `z.string()` with no enum, no section taxonomy and no per-order
            schedule anywhere in the contract. The one per-order field list that
            exists is `GET /api/orders/{"{id}"}/fields`
            (endpoints.ts:169) — that is MACHINE OUTPUT, and reading it here
            would hand the seat the answers it is being measured against.
            INVARIANT 46 and endpoints.ts:290-294 both forbid it, so this form
            takes the path as free text.
          </>
        }
        needs={
          <>
            A blind-side schedule endpoint returning the paths in keying order
            with their labels — the field taxonomy without any extracted value,
            confidence or state on it. It has to be a SEPARATE shape from
            `OrderFieldsResponse`, not a projection of it, or the blindness is
            a filter the browser is trusted to apply.
          </>
        }
      />

      <ContractGap
        drawn="Which seat this is — the A/B label the reconciliation report puts against every divergence"
        has={
          <>
            `TypistSeat` (enums.ts:69, "seat label only — a typist's name never
            appears in blind-fifty data or UI") exists as an enum and is used by
            `Reconciliation.value_a` / `value_b` (entities.ts:202-214), but
            `BlindEntriesRequest` (endpoints.ts:295-302) carries no seat member
            and `BlindEntryInput` carries none either. So the request cannot
            state a seat, and no endpoint reports which one you are sitting in.
          </>
        }
        needs={
          <>
            Either the server derives the seat from the session and says so — in
            which case a read is still needed for the screen to print it — or
            `BlindEntriesRequest` gains a `seat: TypistSeat`. The first is
            better and the second is forgeable, which is the same reasoning
            `GoldenCorrectionRequest` (endpoints.ts:283-296) already records for
            the signer: a browser must not decide who made a record.
          </>
        }
      />
    </div>
  );
}
