import type { Field } from "@titlepipe/contract";

/**

 * Which fields a reviewer may walk — and the answer is the server's. INVARIANT 27

 * (ORPHAN O20, promoted by open-rulings Q3): "field navigation visits ONLY

 * server-queued fields — a reviewer cannot walk into auto-confirmed fields." That is…

 */
export function isQueued(field: Field): boolean {
  return field.state === "needs_review";
}

/** The walkable set, in the server's own order. Never re-sorted. */
export function queuedFields(fields: readonly Field[]): readonly Field[] {
  return fields.filter(isQueued);
}

/**

 * Where selection lands, and the url owns it. INVARIANT 55: "deep links are

 * first-class — `?field=` lands on the exact field in context (URL-owned selection)."

 * So the resolution order is: 1.

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

 * J / k — the next and previous queued field, and it wraps. ANALYSIS-behavior §1

 * records it plainly: "`j`/`k` move `hover`, but `c`/`e`/`q` act on `open` (the first

 * unanswered field), not on `hover`.

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
