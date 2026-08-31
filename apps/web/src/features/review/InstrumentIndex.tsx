import type { PackageInstrument } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * The package instrument index — what is actually in the stack, and a door
 * to each one's first page. Every boundary here is the pipeline's:
 * `OrderPagesResponse` carries the partitioner's own ranges, so this list
 * reports rather than infers — grouping runs of equal page kind would draw
 * boundaries nothing drew. Which row is current is a comparison, not a
 * derivation: the shown page falls inside a range the server drew.
 */
export function InstrumentIndex(props: {
  readonly instruments: readonly PackageInstrument[];
  readonly shown: number;
  readonly onGo: (page: number) => void;
}) {
  return (
    <section
      data-testid="instrument-index"
      aria-label="Package instrument index"
      className="flex shrink-0 flex-col gap-4 border-t border-line-subtle p-8"
    >
      <h3 className="text-label leading-flat font-bold text-ink-muted">
        Package instrument index
      </h3>

      {props.instruments.length === 0 ? (
        /* Not an empty list drawn as nothing. The partitioner ran and found
           no boundary — a real finding, and a different claim from "not
           asked". */
        <p className="text-label leading-body text-ink-secondary">
          The partitioner drew no instrument boundary in this package. That is its
          finding, not a missing read — the pages are still listed above.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {props.instruments.map((instrument) => (
            <li key={instrument.id}>
              <InstrumentRow
                instrument={instrument}
                here={
                  props.shown >= instrument.first_page &&
                  props.shown <= instrument.last_page
                }
                onGo={props.onGo}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InstrumentRow(props: {
  readonly instrument: PackageInstrument;
  readonly here: boolean;
  readonly onGo: (page: number) => void;
}) {
  const it = props.instrument;
  const span =
    it.first_page === it.last_page
      ? `p${it.first_page}`
      : `p${it.first_page}–${it.last_page}`;

  return (
    <button
      type="button"
      data-testid="instrument-row"
      data-instrument-kind={it.kind}
      aria-current={props.here ? "true" : undefined}
      onClick={() => props.onGo(it.first_page)}
      className={cx(
        "tp-state flex w-full items-baseline justify-between gap-6 rounded-lg border px-6 py-4 text-left",
        props.here
          ? "border-action-border bg-action-surface text-action font-semibold"
          : "border-line-strong bg-surface-panel text-ink-secondary hover:bg-row-hover",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-meta leading-close">{it.label}</span>
      {/* A book/page reference is data, so it is mono. Null means the package
          holds no index entry for it, and nothing is drawn in its place. */}
      {it.recorded_ref !== null && (
        <span className="shrink-0 font-mono text-label leading-flat text-ink-muted">
          {it.recorded_ref}
        </span>
      )}
      <span className="shrink-0 font-mono text-label leading-flat font-bold tabular-nums">
        {span}
      </span>
    </button>
  );
}
