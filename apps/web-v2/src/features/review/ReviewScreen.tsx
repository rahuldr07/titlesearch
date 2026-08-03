import { useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Field } from "@titlepipe/contract";
import { orderFieldsQuery, orderSignoffQuery } from "./queries";
import { readingsOf } from "../../entities/field/fieldLabel";
import { ReviewStandin } from "./ReviewStandin";
import { DocumentPane } from "./DocumentPane";
import { FieldsPane } from "./FieldsPane";
import { offersExclude } from "./excludeGate";
import { useReviewEditor } from "./useReviewEditor";
import { useReviewKeys } from "./useReviewKeys";
import { useReviewSelection } from "./useReviewSelection";
import { useReviewWrites } from "./useReviewWrites";
import { Screen } from "../../shared/ui/Screen";

/**
 * The review workstation — TWO PANES, edge to edge, in one frame that does not
 * scroll (export `:664-1082`).
 *
 * LEFT `1 1 52%` is the document: pinned header, one scroller, coverage docked
 * at the foot. RIGHT `1 1 48%` is the fields column: what was ordered, the one
 * decision you are on, the finalize gate, then the draft report beside its
 * section rail. The rail is INSIDE the right pane — a third top-level column
 * starved both halves and pushed the sheet's values out of their rows.
 *
 * THERE IS NO SCREEN HEADER. It used to carry a `Review` title, a second
 * answered-of-needed count and a third "remaining" one, directly under an order
 * strip that already names the order and its four counts. The export draws none
 * of it: the left pane says DOCUMENT and the right pane opens on ORDERED, and
 * the counts belong to the queue that owns them. `{n} remaining` moved onto the
 * decision dock with the two numbers it is arithmetic on.
 *
 * J AND K WALK ONLY SERVER-QUEUED FIELDS (`review.spec` #9). The queue is the
 * server's judgment about what needs a person; walking past it by keyboard is
 * how re-deciding settled fields becomes a habit.
 *
 * SELECTION IS URL-OWNED, so `?field=` is a first-class deep link and a
 * complaint or an escalation can point at the exact field in context.
 *
 * EVERY WRITE GOES THROUGH `useReviewWrites`, which owns the five mutations,
 * derives ONE server note from whichever was submitted last and refuses a
 * duplicate submit. This screen used to wire each mutation by hand and four of
 * the five carried `{ onSuccess: advance }` and nothing else — every refusal
 * they were given was dropped on the floor.
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
  const { selected, select, step, advance } = useReviewSelection(orderId, fields, fieldParam);

  const { mode, setMode, pinned, setPinned, seed, blankNote, setBlankNote, reselect, adopt, openCorrect } =
    useReviewEditor(select);

  const submitConfirm = () => {
    if (selected === null) return;
    writes.confirm(selected.id, selected.value, advance);
  };

  useReviewKeys(
    {
      next: () => step(1),
      previous: () => step(-1),
      // `c` NEVER ACCEPTS A BLANK (`ux.spec` O9). Confirm moved off ⏎ onto `c`
      // in the design remap; the rule moved with it. A missing field demands an
      // explicit click — the only keyboard-layer defence against bulk-accepting
      // absences by holding the confirm key down. The button (`act-confirm`)
      // calls `submitConfirm` directly, so the explicit click still accepts N/A.
      confirm: () => (selected?.value == null ? setBlankNote(true) : submitConfirm()),
      // `e` OPENS the correction field; it never commits (that is Enter, inside
      // the field). Escalate has no hotkey — it is `act-escalate`, a button.
      correct: openCorrect,
      // `x` OBEYS THE SAME RULEBOOK GATE THE BUTTON DOES (R13). It was bound
      // unconditionally, so on `owner.zip` — where `✕ Not our party` is
      // correctly absent — the chord opened the editor anyway and the exclude
      // posted 200. An excluded row is GONE (`conflicts.md` C18).
      exclude: () => setMode("exclude"),
      pass: () => setMode("pass"),
    },
    {
      enabled: mode === "idle" && selected !== null,
      excludable: selected !== null && offersExclude(selected.path),
    },
  );

  // The three states with no workstation to draw live in `ReviewStandin`,
  // which also states why only the empty one keeps the order's history.
  if (isError) return <ReviewStandin orderId={orderId} state="error" />;
  if (isPending) return <ReviewStandin orderId={orderId} state="loading" />;
  if (selected === null) return <ReviewStandin orderId={orderId} state="empty" />;
  const editorSeed = seed ?? selected.value ?? readingsOf(selected)[0]?.value ?? "";

  return (
    <Screen placement="bleed">
      <div className="flex h-full min-h-0">
        <DocumentPane orderId={orderId} field={selected} pinned={pinned?.reading ?? null} />

        <FieldsPane
          orderId={orderId}
          fields={fields}
          signoffLines={signoff.data?.lines ?? []}
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
          onCorrectSubmit={(value, reason) => writes.correct(selected.id, value, reason, advance)}
          onEscalateSubmit={(question) => writes.escalate(selected.id, question, advance)}
          onExcludeSubmit={(reason) => writes.exclude(selected.id, reason, advance)}
          onPassSubmit={(reason) => writes.pass(reason, () => setMode("idle"))}
          onSelect={reselect}
        />
      </div>
    </Screen>
  );
}
