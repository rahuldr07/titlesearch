import { useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Field } from "@titlepipe/contract";
import { orderFieldsQuery, orderSignoffQuery } from "./queries";
import { readingsOf } from "../../entities/field/fieldLabel";
import { ReviewStandin } from "./ReviewStandin";
import { DocumentPane, EVIDENCE_ANCHOR_ID } from "./DocumentPane";
import { EvidenceTieLine } from "./EvidenceTieLine";
import { FieldsPane } from "./FieldsPane";
import { ReviewToolbar } from "./ReviewToolbar";
import { SHEET_ANCHOR_ID } from "./SheetRow";
import { useReviewBindings } from "./useReviewBindings";
import { useReviewEditor } from "./useReviewEditor";
import { useReviewSelection } from "./useReviewSelection";
import { useReviewWrites } from "./useReviewWrites";
import { Screen } from "../../shared/ui/Screen";

/**
 * The review workstation — a thin toolbar over TWO PANES, edge to edge, in one
 * frame that does not scroll.
 *
 * THE DRAFT LEADS. `1 1 62%` left is the fields column — the queue's meter, then
 * the document being assembled, the open decision drawn under the row it
 * decides. `1 1 38%` right is the viewer: page nav, facsimile, then the
 * instruments and the coverage spine docked at its foot.
 *
 * This INVERTS the export (`:664-1082`), which leads with the document at 52%,
 * and the reskin is right about why: the reviewer's object is the DELIVERABLE
 * and the scan is what they consult about it. Reading order is the thing being
 * decided, then the evidence for it. Stated as a deviation; what has to hold
 * either way is the viewer staying wide enough to read a county deed
 * (`DocumentPane`'s 38% floor).
 *
 * THERE IS STILL NO SCREEN HEADER, and the toolbar is not one — it carries no
 * order identity and no counts, because `OrderStrip` above every order screen
 * already carries the ref, the four counts including NEED YOU, and the stamp.
 * `{n} remaining` stays on the decision meter with the numbers it is arithmetic
 * on.
 *
 * J AND K WALK ONLY SERVER-QUEUED FIELDS (`review.spec` #9) — walking past the
 * server's judgment by keyboard is how re-deciding settled fields becomes a
 * habit. SELECTION IS URL-OWNED, so `?field=` is a first-class deep link.
 *
 * EVERY WRITE GOES THROUGH `useReviewWrites`, which owns the five mutations,
 * derives ONE server note from whichever was submitted last and refuses a
 * duplicate submit. This screen used to wire each by hand with
 * `{ onSuccess: advance }` and nothing else — every refusal was dropped.
 */
export function ReviewScreen() {
  const { orderId } = useParams({ from: "/orders/$orderId/review" });
  const { field: fieldParam } = useSearch({ from: "/orders/$orderId/review" });
  const { data, isPending, isError } = useQuery(orderFieldsQuery(orderId));
  // Supplementary to the fields above — a pending or failed fetch just means
  // no disclosure cards render yet, never a false claim about what the
  // abstractor answered.
  const signoff = useQuery(orderSignoffQuery(orderId));

  const writes = useReviewWrites(orderId);

  const fields: Field[] = data?.fields ?? [];
  const { selected, select, step, advance } = useReviewSelection(
    orderId,
    fields,
    fieldParam,
  );

  const {
    mode,
    setMode,
    pinned,
    setPinned,
    seed,
    blankNote,
    setBlankNote,
    reselect,
    adopt,
    openCorrect,
  } = useReviewEditor(select);

  // The key rules (`c` never accepts a blank, `x` obeys the R13 gate, `e` only
  // opens) live with their bindings in `useReviewBindings`.
  const { submitConfirm } = useReviewBindings({
    selected,
    mode,
    writes,
    advance,
    step,
    setMode,
    setBlankNote,
    openCorrect,
  });

  // The three states with no workstation to draw live in `ReviewStandin`,
  // which also states why only the empty one keeps the order's history.
  if (isError) return <ReviewStandin orderId={orderId} state="error" />;
  if (isPending) return <ReviewStandin orderId={orderId} state="loading" />;
  if (selected === null) return <ReviewStandin orderId={orderId} state="empty" />;
  const editorSeed = seed ?? selected.value ?? readingsOf(selected)[0]?.value ?? "";

  return (
    <Screen placement="bleed">
      <div className="flex h-full min-h-0 flex-col">
        <ReviewToolbar orderId={orderId} onRaiseQuery={() => setMode("escalate")} />

        <div className="flex min-h-0 flex-1">
          <FieldsPane
            orderId={orderId}
            fields={fields}
            signoff={signoff.data}
            selected={selected}
            pinned={pinned}
            mode={mode}
            seed={editorSeed}
            writePending={writes.pending}
            serverNote={writes.serverNote}
            blankNote={blankNote}
            onPin={setPinned}
            onAdopt={adopt}
            onConfirm={submitConfirm}
            onCorrect={openCorrect}
            onMode={setMode}
            onCorrectSubmit={(value, reason) =>
              writes.correct(selected.id, value, reason, advance)
            }
            onEscalateSubmit={(question) =>
              writes.escalate(selected.id, question, advance)
            }
            onExcludeSubmit={(reason) => writes.exclude(selected.id, reason, advance)}
            onPassSubmit={(reason) => writes.pass(reason, () => setMode("idle"))}
            onSelect={reselect}
          />

          <DocumentPane
            orderId={orderId}
            field={selected}
            fields={fields}
            pinned={pinned?.reading ?? null}
          />
        </div>

        {/* Drawn last, over both panes, so neither needs to know it exists.
            Nothing is drawn when the field cites no coordinates. */}
        <EvidenceTieLine fromId={SHEET_ANCHOR_ID} toId={EVIDENCE_ANCHOR_ID} />
      </div>
    </Screen>
  );
}
