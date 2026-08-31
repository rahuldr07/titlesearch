import type { NullStateRow } from "@titlepipe/contract";
import { NaReason as NaReasonEnum } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { NoValueChip } from "../../entities/field/NoValueChip";

/**
 * The null state matrix — the screen that teaches the four apart. Driven by
 * `NaReasonEnum.options`, not by the rows that happen to arrive: a reason
 * the server declared nothing for still gets its section, and says so.
 * `NoValueChip` carries the render — mark, ink, border style and fill all
 * differ per reason, so the four survive greyscale and a red-green
 * deficiency both.
 */
export function NullStateMatrix(props: { readonly rows: readonly NullStateRow[] }) {
  return (
    <Card padding="none">
      <ul>
        {NaReasonEnum.options.map((reason) => {
          const rows = props.rows.filter((row) => row.reason === reason);
          return (
            <li
              key={reason}
              data-na-reason={reason}
              className="flex flex-col gap-6 border-b border-line-subtle px-12 py-10 last:border-b-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-6">
                <NoValueChip render={reason} />
                {/* The enum member is the identifier the rulebook uses. */}
                <span className="font-mono text-label leading-flat text-ink-faint">
                  {reason}
                </span>
              </div>
              {rows.length === 0 ? (
                <p className="text-meta leading-body text-ink-muted">
                  No field is declared with this reason here. The state still exists;
                  this jurisdiction simply has nothing carrying it.
                </p>
              ) : (
                <ul className="flex flex-col gap-5">
                  {rows.map((row) => (
                    <NullStateEntry key={row.path} row={row} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function NullStateEntry(props: { readonly row: NullStateRow }) {
  return (
    <li className="flex flex-col gap-2 border-l border-line-faint pl-8">
      <div className="flex flex-wrap items-baseline gap-5">
        <span className="text-meta font-medium leading-close text-ink-primary">
          {props.row.label}
        </span>
        <span className="font-mono text-label leading-flat text-ink-muted">
          {props.row.path}
        </span>
      </div>
      {/* The literal the report emits — quoted so it reads as a string, not prose. */}
      <span className="font-mono text-meta leading-close text-ink-secondary">
        “{props.row.renders_as}”
      </span>
    </li>
  );
}
