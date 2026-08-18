import type { Field, OrderSignoffResponse } from "@titlepipe/contract";
import { type Pinned } from "./useReviewEditor";
import { DecisionColumn } from "./DecisionColumn";
import { DecisionDock } from "./DecisionDock";
import { FinalizeBar } from "./FinalizeBar";
import { OrderedRow } from "./OrderedRow";
import { QueueRest } from "./QueueRest";
import { ReportPane } from "./ReportPane";
import { type ReviewMode } from "./ReviewEditors";

interface FieldsPaneProps {
  orderId: string;
  fields: readonly Field[];
  /*
   * THE WHOLE SIGN-OFF, NOT ITS LINES. `ReportPane` renders the signature
   * RECORD below the draft — signer, timestamp and all — and those live on the
   * response, not on a line. Passing both the response and a lines array would
   * be two props carrying one fact, which is how they drift; the two consumers
   * that only need lines take `.lines` at the point of use.
   *
   * `undefined` while the query is in flight, and that is a THIRD state, not a
   * falsy one: absent means "not known yet" and must never render as "unsigned".
   */
  signoff: OrderSignoffResponse | undefined;
  selected: Field;
  pinned: Pinned | null;
  mode: ReviewMode;
  seed: string;
  writePending: boolean;
  serverNote: string | null;
  blankNote: boolean;
  onPin: (pinned: Pinned) => void;
  onAdopt: (value: string) => void;
  onConfirm: () => void;
  onCorrect: () => void;
  onMode: (mode: ReviewMode) => void;
  onCorrectSubmit: (value: string, reason: string) => void;
  onEscalateSubmit: (question: string) => void;
  onExcludeSubmit: (reason: string) => void;
  onPassSubmit: (reason: string) => void;
  onSelect: (path: string) => void;
}

/**
 * "RIGHT: FIELDS" was the export's label (`:832`) when this pane sat beside the
 * document on the right. It LEADS the frame now, and it is a COLUMN OF THREE
 * BANDS rather than four:
 *
 *   decision meter   flex:0 0 auto   how much of the queue is answered
 *   draft + rest     flex:1          the document being assembled, scrolling
 *   finalize bar     flex:0 0 auto   the gate
 *
 * THE OPEN DECISION MOVED INTO THE DRAFT, and that fixes this screen's worst
 * documented defect: the card asked about a field in one band, the sheet
 * printed that field's value in another, and `QueueRest` printed it a THIRD
 * time in between. `ReportPane` takes the card as a slot and `CallBackSheet`
 * draws it under the row it decides. Every write path is unchanged — same
 * `DecisionColumn`, same five mutations, same refusals.
 *
 * ONLY ONE REGION SCROLLS, and it is not the page: the meter and the gate stay
 * readable while a reviewer reads to the bottom of a 21-field sheet.
 *
 * THE BLOCK IS STILL `decision-dock` — meter plus rest of the queue.
 * `review.spec:180` requires that heading and its count inside this element.
 * It no longer wraps the open card, because the card is no longer here.
 *
 * `QueueRest` STAYS AND ITS OWN FILE ADMITS THE COST — its rows repeat values
 * the draft prints. That is now the LAST duplication on the screen rather than
 * one of three, and it is spec-pinned, so retiring it is an owner's call and
 * not a restyle's. Flagged, not hidden.
 */
export function FieldsPane({
  orderId,
  fields,
  signoff,
  selected,
  pinned,
  mode,
  seed,
  writePending,
  serverNote,
  blankNote,
  onPin,
  onAdopt,
  onConfirm,
  onCorrect,
  onMode,
  onCorrectSubmit,
  onEscalateSubmit,
  onExcludeSubmit,
  onPassSubmit,
  onSelect,
}: FieldsPaneProps) {
  return (
    <section
      aria-label="Fields"
      className="flex min-h-0 min-w-0 shrink grow basis-[62%] flex-col bg-surface-app"
    >
      <OrderedRow orderId={orderId} />

      <div
        data-testid="decision-dock"
        className="flex min-h-0 flex-none flex-col border-b border-line-strong bg-surface-panel"
      >
        <DecisionDock fields={fields} selectedPath={selected.path} />
        <QueueRest fields={fields} selectedPath={selected.path} onSelect={onSelect} />
      </div>

      <ReportPane
        orderId={orderId}
        fields={fields}
        signoff={signoff}
        selectedPath={selected.path}
        onSelect={onSelect}
        renderDecision={(field) => (
          <DecisionColumn
            field={field}
            pinned={pinned}
            mode={mode}
            seed={seed}
            machineValue={field.value ?? ""}
            writePending={writePending}
            serverNote={serverNote}
            blankNote={blankNote}
            onPin={onPin}
            onAdopt={onAdopt}
            onConfirm={onConfirm}
            onCorrect={onCorrect}
            onMode={onMode}
            onCorrectSubmit={onCorrectSubmit}
            onEscalateSubmit={onEscalateSubmit}
            onExcludeSubmit={onExcludeSubmit}
            onPassSubmit={onPassSubmit}
          />
        )}
      />

      <FinalizeBar fields={fields} signoffLines={signoff?.lines ?? []} />
    </section>
  );
}
