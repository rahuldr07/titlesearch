import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * WHO IS SEATED, AND HOW FAR THEY HAVE GOT — neither of which has a shape.
 *
 * These are the two an ops reader opens this door for, and they are the two the
 * contract does not have. A dashboard drawn with plausible seats and plausible
 * bars would read as FINISHED to everybody who opened it, including the backend
 * owner deciding what still needs building — which is the specific harm root
 * AGENTS.md's "never emit a value you can't cite" exists to prevent.
 *
 * ══ THE SHAPE OF THE ASK MATTERS, NOT JUST ITS EXISTENCE ═══════════════════
 *
 * INVARIANT 23 and AGENTS.md ban pace indicators, throughput counters and time
 * estimates outright, and `PRODUCT.md` records that per-person throughput does
 * not exist as data anywhere in this system — deliberately, not yet. So the ask
 * below is for COVERAGE, a count of paths keyed against a schedule, and it is
 * written that way on purpose. A progress endpoint that arrived carrying rates,
 * elapsed time or a per-typist ranking would have to be refused at this screen,
 * and it is cheaper to say so before it is built than after.
 */
export function RosterGaps() {
  return (
    <div className="flex flex-col gap-8">
      <ContractGap
        drawn="The seat roster — which seats are open on this package, and which of A and B is filled"
        has={
          <>
            Nothing. `TypistSeat` (enums.ts:69) is an enum of two labels and is
            all that exists; there is no seat entity, no assignment shape and no
            endpoint of any kind under `/api/blind` except the entry POST
            (endpoints.ts:295-307). `PeopleResponse` (intake.ts:336) is the
            shop roster and is the wrong object twice over — a blind seat is
            deliberately anonymous (enums.ts:68, &ldquo;a typist&rsquo;s name
            never appears in blind-fifty data or UI&rdquo;), and temp typists
            are not staff rows.
          </>
        }
        needs={
          <>
            A seat-occupancy read keyed on the ORDER and the SEAT LABEL, never
            on a person: which of A and B is currently open, and whether each
            has been filed. It must not carry a name, or this screen becomes the
            place the anonymity the protocol depends on is broken.
          </>
        }
      />

      <ContractGap
        drawn="Per-seat progress on this package — how many of the scheduled fields each seat has keyed"
        has={
          <>
            Nothing, and there are two halves missing rather than one. There is
            no read of blind entries at all — `POST .../entries` returns
            `entry_ids` and nothing else, and endpoints.ts:290-294 says widening
            it is a design defect — and there is no capture schedule to measure
            against either, since `BlindEntryInput.path` (entities.ts:289) is a
            bare string with no per-order field list behind it.
          </>
        }
        needs={
          <>
            A blind-side coverage read: paths keyed over paths scheduled, per
            seat, with NO value in the payload — the counts can be public
            without the entries being. Coverage only. INVARIANT 23 refuses
            rates, elapsed time, estimates and any per-typist ordering, so a
            shape carrying them would be refused at this screen rather than
            drawn.
          </>
        }
      />
    </div>
  );
}
