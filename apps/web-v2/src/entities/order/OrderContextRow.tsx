import type { ReactNode } from "react";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * What was ordered: the product, the period it covers, and the config version
 * the order was frozen against.
 *
 * RULE: one row, one source. FAILURE PREVENTED: this row existed three ways and
 * no two agreed — completeness read the product and period off the server, the
 * delivered screen printed two hardcoded demo constants, and Review omitted the
 * row entirely. A fabrication on one screen and an omission on another are the
 * same defect seen from two sides, and one component makes the gap visible in
 * one place instead of disguising it at three call sites.
 *
 * "ORDERED" IS WRITTEN IN CAPITALS, not transformed into them. A CSS
 * `text-transform` does not change what the text says, and the export's own
 * strip (`:836`) is the word this row prints.
 *
 * THE PERIOD IS A DATE SPAN, not a state word, so it is not shouted:
 * "07/18/1986 – 07/18/2026" in 9px letterspaced caps stops being a number a
 * person can compare character by character, which is the only thing this chip
 * is for. Mono face, normal case, normal tracking — and that tracking is also
 * what keeps the row on one line, since `tracking-label` over forty characters
 * spends 52px on air alone and pushes the badge under the product name.
 *
 * NULL IS A STATEMENT, NOT A BLANK. `OrderContextResponse.period_label` is
 * nullable — an order that failed validation has no resolved period — so the
 * chip is dropped whole rather than rendered empty or filled with a guess. Same
 * for `configVersion`: absent means the server did not say which config this
 * order froze against, and "config v?" would be a value with nothing behind it.
 * A caller whose product is null drops this row entirely; a row headed ORDERED
 * that cannot name what was ordered is the fabrication in a quieter form.
 */
export interface OrderContextRowProps {
  /** Server-supplied. A caller with no resolved product renders no row. */
  productName: string;
  /** The dated span, e.g. "40-year period · 07/18/1986 – 07/18/2026". */
  periodLabel: string | null;
  /** e.g. "config v4". Omitted entirely when the server does not say. */
  configVersion?: string | undefined;
  /** Right-hand slot for a screen-owned control. */
  trailing?: ReactNode;
}

export function OrderContextRow({
  productName,
  periodLabel,
  configVersion,
  trailing,
}: OrderContextRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      <Eyebrow variant="caption">ORDERED</Eyebrow>
      <span className="text-md font-semibold text-ink-primary">{productName}</span>

      {periodLabel === null ? null : (
        <Chip
          tone="action"
          size="md"
          shape="mono"
          bordered
          className="text-xs tracking-normal normal-case"
        >
          {periodLabel}
        </Chip>
      )}

      {configVersion === undefined ? null : (
        <span className="rounded-4 border border-line-strong px-3 py-1 font-mono text-micro text-ink-muted">
          {configVersion} · frozen
        </span>
      )}

      {trailing === undefined ? null : <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
