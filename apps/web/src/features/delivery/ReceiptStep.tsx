import { cx } from "../../components/ui";

/**
 * One receipt row. The time column fits the server's full instant — nothing
 * reformats it.
 */
export function ReceiptStep({
  at,
  settled,
  what,
  detail,
}: {
  readonly at: string | null;
  readonly settled: boolean;
  readonly what: string;
  readonly detail: string;
}) {
  return (
    <li className="grid grid-cols-[152px_20px_minmax(0,1fr)] items-baseline gap-4 border-b border-line-subtle py-5 last:border-b-0">
      {/* An instant is data (mono); "not recorded" is a sentence about its absence (sans). */}
      <span
        className={cx(
          "text-label leading-close text-ink-muted",
          at === null ? "font-sans" : "font-mono",
        )}
      >
        {at ?? "not recorded"}
      </span>
      <span
        aria-hidden
        className={cx(
          "font-mono text-meta leading-flat font-bold",
          settled ? "text-state-settled" : "text-state-attend",
        )}
      >
        {settled ? "✓" : "◆"}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-sans text-meta leading-close font-semibold text-ink-primary">
          {what}
        </span>
        <span className="font-mono text-label leading-close break-all text-ink-muted">
          {detail}
        </span>
      </span>
    </li>
  );
}
