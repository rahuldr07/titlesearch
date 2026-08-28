import { ContractGap } from "../../entities/contract/ContractGap";

/** What the seat still cannot state, named rather than worked around. */
export function SeatGaps() {
  return (
    <div className="flex flex-col gap-8">
      <ContractGap
        drawn="Which seat filed these entries — the A/B label the reconciliation report puts against every divergence"
        has={
          <>
            `CaptureScheduleResponse.seat` names the seat on the READ, so the
            sheet can print it. The WRITE cannot state it:
            `BlindEntriesRequest` (endpoints.ts:295-302) carries no seat member
            and neither does `BlindEntryInput`, so nothing the browser sends
            says which seat it came from.
          </>
        }
        needs={
          <>
            The server derives the seat from the session and records it. Adding
            `seat: TypistSeat` to the request would be forgeable, which is the
            same reasoning `GoldenCorrectionRequest` already records for the
            signer: a browser must not decide who made a record.
          </>
        }
      />

      <ContractGap
        drawn="The page image beside the sheet — a typist keys off the package, and the package is not on this screen"
        has={
          <>
            `GET /api/orders/{"{id}"}/pages` is the only page read in the
            contract and it is ORDER-scoped, so reaching it from the seat would
            open an order-side door on a blind screen. The schedule carries a
            `pages` count and no page.
          </>
        }
        needs={
          <>
            A blind-side page read — the scan and its page number, with no
            extracted region, no confidence overlay and no field mapping on it.
            It has to be a separate shape from `OrderPagesResponse`, not a
            filtered projection of it, or the blindness becomes a rule the
            browser is trusted to apply.
          </>
        }
      />
    </div>
  );
}
