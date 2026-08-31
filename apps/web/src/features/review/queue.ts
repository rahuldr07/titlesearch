import type { Field } from "@titlepipe/contract";

/**
 * Which fields a reviewer may walk — the answer is the server's: navigation
 * visits only server-queued fields, never auto-confirmed ones.
 */
export function isQueued(field: Field): boolean {
  return field.state === "needs_review";
}

/** The walkable set, in the server's own order. Never re-sorted. */
function queuedFields(fields: readonly Field[]): readonly Field[] {
  return fields.filter(isQueued);
}

/**
 * Where selection lands, and the URL owns it: `?field=` lands on the exact
 * field, then the first queued field, then the first field at all.
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

/** J / K — the next and previous queued field, and it wraps. */
export function stepSelection(
  fields: readonly Field[],
  current: Field | null,
  direction: 1 | -1,
): Field | null {
  const queue = queuedFields(fields);
  if (queue.length === 0) return current;

  const at = current === null ? -1 : queue.findIndex((f) => f.id === current.id);
  if (at < 0) return queue[0] ?? null;

  // Wraps modulo the queue length — j and k never dead-end.
  const next = (at + direction + queue.length) % queue.length;
  return queue[next] ?? null;
}
