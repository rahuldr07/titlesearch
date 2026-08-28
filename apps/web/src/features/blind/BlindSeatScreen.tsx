import { useState } from "react";
import type { BlindEntryInput, CaptureScheduleResponse } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { QueryState } from "../../entities/state/QueryState";
import { CAPTURE_ORDER, captureSchedule } from "../../shared/blindQueries";
import { blankSheet, isAnswered, toWire, type DraftEntry, type DraftSheet } from "./draftEntry";
import { CaptureSheet } from "./CaptureSheet";
import { CaptureReceipt } from "./CaptureReceipt";
import { SeatGaps } from "./SeatGaps";
import { useCapture } from "./useCapture";

/**
 * SCREEN — THE CAPTURE SEAT, at `/blind`.
 *
 * INVARIANT 46: the seat shows no machine value, no confidence, no engine, no
 * other seat's entry and no order state. `GET /api/blind/{order}/schedule` is
 * the only read, and it is blind-side by construction — a list of what to key,
 * with nothing keyed into it. `/api/orders/{id}/fields` is the answer sheet and
 * is never touched here. The rail and the command palette are withheld by the
 * shell (`app/chrome/captureSeat.ts`); nothing is repeated in this file.
 */
export function BlindSeatScreen() {
  const schedule = useRead(captureSchedule(CAPTURE_ORDER));

  return (
    <div
      data-testid="blind-seat"
      tabIndex={0}
      role="region"
      aria-label="Capture seat"
      className="tp-state tp-screen-enter flex h-full min-h-0 flex-col items-center gap-12 overflow-y-auto bg-surface-sunken p-14"
    >
      <div className="flex w-full max-w-360 flex-col gap-4">
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          Capture seat
        </h1>
        <p className="font-sans text-meta leading-body text-ink-secondary">
          Key what the package says, field by field, with the page it came off
          and how sure you are. You are not shown the machine&rsquo;s reading or
          the other seat&rsquo;s — that is what makes the measurement worth
          taking, and the server enforces it rather than this screen.
        </p>
      </div>

      <QueryState query={schedule} of="the capture schedule">
        {(data) => <SheetBody schedule={data} />}
      </QueryState>

      <div className="flex w-full max-w-360 flex-col gap-10">
        <SeatGaps />
      </div>
    </div>
  );
}

function SheetBody(props: { readonly schedule: CaptureScheduleResponse }) {
  const [sheet, setSheet] = useState<DraftSheet>(() => blankSheet(props.schedule.sections));

  const capture = useCapture(props.schedule.order_id, () => {
    // The server accepted them; the sheet is cleared for the next package. The
    // filed entries are NOT redrawn — the seat has no read-back of its own
    // entries, and inventing one would be the blindness leaking.
    setSheet(blankSheet(props.schedule.sections));
  });

  const answered = Object.values(sheet).filter(isAnswered);
  const missingRequired = props.schedule.sections
    .flatMap((section) => section.fields)
    .filter((field) => {
      const draft = sheet[field.path];
      return field.required && (draft === undefined || !isAnswered(draft));
    })
    .map((field) => field.label);

  function file() {
    const entries: BlindEntryInput[] = [];
    for (const draft of answered) {
      // Narrowed rather than defaulted: a `?? "certain"` would invent the one
      // answer the three-part contract exists to ask for.
      if (draft.confidence === null) return;
      entries.push(toWire(draft, draft.confidence));
    }
    if (entries.length === 0) return;
    capture.mutate({ entries });
  }

  return (
    <div className="flex w-full max-w-360 flex-col gap-10">
      <CaptureSheet
        schedule={props.schedule}
        sheet={sheet}
        onChange={(next: DraftEntry) => {
          setSheet({ ...sheet, [next.path]: next });
        }}
        answered={answered}
        missingRequired={missingRequired}
        pending={capture.isPending}
        onFile={file}
      />
      <CaptureReceipt error={capture.error} accepted={capture.data} />
    </div>
  );
}
