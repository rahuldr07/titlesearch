import type { RequiredCountersign } from "./CountersignRow";

/**
 * THE SETTLED SECOND READ — the design's green block. Both shapes it can take
 * are the server's answer, not a conclusion drawn here: an empty `required`
 * means the server classifies nothing on this order as ruinous, and a full
 * `countersigned_by` column means it recorded a second reader for every one.
 */
export function CountersignSettled(props: {
  readonly required: readonly RequiredCountersign[];
}) {
  const signers = [
    ...new Set(
      props.required.flatMap((entry) =>
        entry.countersigned_by === null ? [] : [entry.countersigned_by],
      ),
    ),
  ];

  return (
    <div
      data-testid="countersign-settled"
      className="rounded-r-lg border-l-4 border-l-state-settled bg-state-settled-surface p-9"
    >
      <p className="text-body leading-tight font-bold text-state-settled">
        {signers.length === 0
          ? "No T1 second read is outstanding"
          : "All examination requirements verified"}
      </p>
      <p className="mt-2 text-meta leading-body text-ink-secondary">
        {signers.length === 0
          ? "The server lists no ruinous-exposure rulings on this order."
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
