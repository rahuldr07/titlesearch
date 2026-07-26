import type { Field } from "@titlepipe/contract";
import { NoValue } from "./NoValue";
import { noValueOf } from "./noValueState";

/**
 * One field in the assembled report.
 *
 * Renders ONLY what the server sent. It does not compute `state`, does not
 * decide whether the field needs review, and does not read `value === null` for
 * anything except handing off to NoValue (see noValue.ts for why that one read
 * is legitimate).
 *
 * Provenance is the product (principle 6). A value that arrives with an empty
 * provenance envelope renders VISIBLY FLAGGED — never silently normal, and
 * never as a blank. That failure shape was caught six times in prototyping.
 */

/** Human label from a dotted path: `mortgages.1.lender` → `MTG 1 — LENDER`. */
export function fieldLabel(path: string): string {
  const SECTION: Record<string, string> = {
    mortgages: "MTG",
    judgments: "JGMT",
    assessment: "ASSESS",
  };
  const parts = path.split(".");
  const head = parts[0] ?? path;
  const section = SECTION[head] ?? head.toUpperCase();
  const rest = parts.slice(1);
  const idx = rest[0] !== undefined && /^\d+$/.test(rest[0]) ? rest.shift() : null;
  const tail = rest.join(" ").replace(/_/g, " ").toUpperCase();
  return idx === null ? `${section} ${tail}`.trim() : `${section} ${idx} — ${tail}`;
}

/**
 * A value is only trustworthy if it can be cited. `source_page` is the minimum
 * citation — the server sends the doc, page, snippet and coords together, so a
 * null page means the envelope is empty.
 */
function hasProvenance(f: Field): boolean {
  return f.source_page !== null && f.source_doc_id !== null;
}

export function FieldRow({
  field,
  selected,
  onSelect,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
}) {
  const nv = noValueOf(field);

  return (
    <button
      type="button"
      data-testid={`row-${field.path}`}
      data-selected={selected ? "1" : "0"}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 border-l-2 px-4 py-2.5 text-left ${
        selected
          ? "border-l-page-ref bg-page-ref-surface"
          : "border-l-transparent hover:bg-surface-raised"
      }`}
    >
      <span className="w-1/3 shrink-0 pt-0.5 text-micro font-semibold tracking-badge text-ink-muted uppercase">
        {fieldLabel(field.path)}
      </span>

      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
        {nv !== null ? (
          <NoValue state={nv} />
        ) : (
          <>
            <span className="font-mono text-md break-words text-ink-primary">
              {field.value}
            </span>
            {hasProvenance(field) ? (
              <span
                data-testid={`page-${field.path}`}
                className="rounded-xs border border-page-ref-border bg-page-ref-surface px-1.5 py-px font-mono text-tiny font-semibold text-page-ref"
              >
                p{field.source_page}
              </span>
            ) : (
              /*
               * A value with nothing behind it. This is the enemy (principle 6).
               * It is flagged loudly rather than rendered as an ordinary value,
               * and it is NOT downgraded to a blank — the value is still shown,
               * because hiding it would hide the defect.
               */
              <span
                data-testid={`no-provenance-${field.path}`}
                className="rounded-xs border border-state-halt-border bg-state-halt-surface px-1.5 py-px font-mono text-tiny font-bold tracking-badge text-state-halt-ink uppercase"
              >
                NO PROVENANCE
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
}
