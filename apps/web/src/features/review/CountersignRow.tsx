import type { CountersignsResponse } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { fieldLabel } from "./fieldNaming";

/** One entry of the server's `required` list — its shape, never restated. */
export type RequiredCountersign = CountersignsResponse["required"][number];

/**
 * One T1 ruling awaiting its second read. The row draws what arrived and
 * nothing else: the server's value, the examiner the server says ruled it,
 * and `countersigned_by` — the only thing that may say a second read
 * exists.
 */
export function CountersignRow(props: {
  readonly entry: RequiredCountersign;
  /** Why the act is held, or null. A blocked control states its reason. */
  readonly heldBecause: string | null;
  readonly onCountersign: () => void;
}) {
  const { entry } = props;

  return (
    <li
      data-testid={`countersign-${entry.field_id}`}
      className="flex flex-wrap items-baseline gap-5 rounded-lg border border-action-border-strong bg-surface-panel px-6 py-5"
    >
      <span
        title="Ruinous exposure — a second examiner must countersign this ruling."
        className="font-mono text-label leading-flat font-bold text-action"
      >
        T1
      </span>

      <span
        title={entry.path}
        className="w-75 shrink-0 truncate font-mono text-label leading-flat text-ink-muted"
      >
        {fieldLabel(entry.path)}
      </span>

      <span className="min-w-0 flex-1 font-mono text-meta leading-close font-semibold break-words text-ink-primary">
        {entry.value ?? "The server recorded no value for this ruling."}
      </span>

      <span className="text-label leading-flat whitespace-nowrap text-ink-faint">
        Ruled by {entry.ruled_by}
      </span>

      {entry.countersigned_by === null ? (
        <Button
          variant="secondary"
          data-testid={`countersign-submit-${entry.field_id}`}
          disabledBecause={props.heldBecause}
          onPress={props.onCountersign}
        >
          Countersign
        </Button>
      ) : (
        <span className="text-label leading-flat whitespace-nowrap text-state-settled">
          <span aria-hidden>✓</span> Countersigned by {entry.countersigned_by}
        </span>
      )}
    </li>
  );
}
