import type { Field } from "@titlepipe/contract";

/**
 * WHICH FIELDS A REVIEWER MAY WALK — AND THE ANSWER IS THE SERVER'S.
 *
 * INVARIANT 27 (ORPHAN O20, promoted by open-rulings Q3): "field navigation
 * visits ONLY server-queued fields — a reviewer cannot walk into auto-confirmed
 * fields." That is a rule about WHOSE JUDGEMENT DECIDES what needs a person,
 * not about what is convenient to skip past.
 *
 * So the queue is `state === "needs_review"` and nothing else. Not "has no
 * value", not "confidence is low", not "the readings disagree" — every one of
 * those is a threshold, and `enums.ts:3-8` puts every threshold on the server:
 * "0.99 stays queued, 0.01 stays confirmed". A field the server auto-confirmed
 * at 0.01 is not walkable here however wrong it looks, because deciding
 * otherwise is exactly the promotion the rule forbids.
 *
 * ══ WHY `excluded_reason` DOES NOT LEAVE THE QUEUE ═════════════════════════
 *
 * `entities.ts:110-121` is explicit that suppression is ORTHOGONAL to `state`,
 * not a member of it — "a judgment hit that is not against our owner may
 * already have been confirmed or corrected before anybody noticed". So an
 * excluded field's walkability is still `state`'s answer, and this file does
 * not invent a sixth state by reading a field that was deliberately kept out
 * of the state machine.
 */
export function isQueued(field: Field): boolean {
  return field.state === "needs_review";
}

/** The walkable set, in the server's own order. Never re-sorted. */
export function queuedFields(fields: readonly Field[]): readonly Field[] {
  return fields.filter(isQueued);
}

/**
 * WHERE SELECTION LANDS, AND THE URL OWNS IT.
 *
 * INVARIANT 55: "deep links are first-class — `?field=` lands on the exact
 * field in context (URL-owned selection)." So the resolution order is:
 *
 *   1. `?field=` — an explicit ask, honoured even for a field that is NOT
 *      queued. A reviewer sent a link to `judgments.1.case_no` is being shown
 *      that field; silently landing them somewhere else because the pipeline
 *      has since settled it would be the link lying about where it went.
 *   2. the first QUEUED field — the ordinary open decision.
 *   3. the first field at all — an order with nothing queued still has to show
 *      the reviewer what it holds rather than an empty pane.
 *
 * `?field=` carries a PATH, not an id. A path is what a person can read off a
 * screen and paste into a message, and it is what every other surface in this
 * product names a field by (`Reconciliation.path`, `BenchFailRow.path`,
 * `Complaint.field_path`, `GoldenField.path`). An opaque `fld_zip` in an
 * address bar is a link nobody can check.
 */
export function resolveSelection(
  fields: readonly Field[],
  requestedPath: string | undefined,
): Field | null {
  if (requestedPath !== undefined) {
    const asked = fields.find((f) => f.path === requestedPath);
    if (asked !== undefined) return asked;
  }
  return queuedFields(fields)[0] ?? fields[0] ?? null;
}

/**
 * J / K — THE NEXT AND PREVIOUS QUEUED FIELD, AND IT WRAPS.
 *
 * ══ THE PROTOTYPE'S DEFECT, NOT REPRODUCED ═════════════════════════════════
 *
 * ANALYSIS-behavior §1 records it plainly: "`j`/`k` move `hover`, but
 * `c`/`e`/`q` act on `open` (the first unanswered field), not on `hover`.
 * Navigating with `j` and then pressing `c` confirms a DIFFERENT field than the
 * one the focus ring is on. This is a real defect in the prototype, not a
 * subtlety to reproduce." §3 makes it a requirement: "`c`/`e`/`q` must act on
 * the FOCUSED field (the `j`/`k` cursor) … fixing it is required, not
 * optional."
 *
 * There is therefore ONE cursor in this feature and every action reads it.
 * That is why this function returns a field rather than an index, and why no
 * caller ever holds a second notion of "the open one".
 *
 * ══ A SELECTION OFF THE QUEUE STILL MOVES ══════════════════════════════════
 *
 * A `?field=` deep link can land on a field that is not queued. Pressing `j`
 * from there enters the queue at its head rather than dead-ending, because the
 * alternative is a keyboard that silently does nothing — and a chord that does
 * nothing is indistinguishable from a chord that is broken (`chords.ts`).
 */
export function stepSelection(
  fields: readonly Field[],
  current: Field | null,
  direction: 1 | -1,
): Field | null {
  const queue = queuedFields(fields);
  if (queue.length === 0) return current;

  const at = current === null ? -1 : queue.findIndex((f) => f.id === current.id);
  if (at < 0) return queue[0] ?? null;

  // Wraps modulo the queue length — j and k never dead-end (ANALYSIS §1).
  const next = (at + direction + queue.length) % queue.length;
  return queue[next] ?? null;
}
