import type { RequiredCountersign } from "./CountersignRow";

/**
 * The second read with nothing outstanding — THREE answers, not two, and
 * every one of them the server's rather than a conclusion drawn here.
 *
 * A ledger row opens when the first examiner rules a T1 field, so an empty
 * `required` used to be read as "the server classifies nothing on this order
 * as ruinous" and painted green. On the real county package that put an
 * all-clear on screen over eleven unruled ruinous-exposure fields, while gate
 * g4 on the very next door said `11 T1 rulings not yet made`. The server now
 * sends `unruled` — the same figure g4 quotes — and a positive count is the
 * WAITING answer, in the attend tone: nothing is outstanding to countersign
 * because nothing has been ruled yet, which is not the same as clear.
 */
export function CountersignSettled(props: {
  readonly required: readonly RequiredCountersign[];
  /** T1 fields nobody has ruled yet, counted by the server. */
  readonly unruled: number;
}) {
  const signers = [
    ...new Set(
      props.required.flatMap((entry) =>
        entry.countersigned_by === null ? [] : [entry.countersigned_by],
      ),
    ),
  ];

  /* The waiting answer outranks the empty one: rulings are still to come. */
  if (signers.length === 0 && props.unruled > 0) {
    return (
      <div
        data-testid="countersign-settled"
        data-second-read="waiting"
        className="rounded-r-lg border-l-4 border-l-state-attend bg-state-attend-surface p-9"
      >
        <p className="text-body leading-tight font-bold text-state-attend">
          {props.unruled === 1
            ? "1 T1 ruling has still to be made"
            : `${String(props.unruled)} T1 rulings have still to be made`}
        </p>
        <p className="mt-2 text-meta leading-body text-ink-secondary">
          Nothing is outstanding to countersign yet — a ruinous-exposure field joins
          the second-read ledger when the first examiner rules it, and the release
          gate stays shut until each one has been read twice.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="countersign-settled"
      data-second-read={signers.length === 0 ? "none" : "countersigned"}
      className="rounded-r-lg border-l-4 border-l-state-settled bg-state-settled-surface p-9"
    >
      <p className="text-body leading-tight font-bold text-state-settled">
        {signers.length === 0
          ? "No T1 second read is outstanding"
          : "All examination requirements verified"}
      </p>
      <p className="mt-2 text-meta leading-body text-ink-secondary">
        {signers.length === 0
          ? "The server classifies nothing on this order as ruinous exposure, so no ruling here needs a second examiner."
          : "Every ruinous-exposure ruling on this order carries a second examiner's countersign, so no single examiner released it."}
      </p>
      {signers.length > 0 && (
        <p className="mt-3 font-mono text-label leading-flat text-state-settled">
          <span aria-hidden>✓</span> T1 second read countersigned by {signers.join(", ")}
        </p>
      )}
    </div>
  );
}
