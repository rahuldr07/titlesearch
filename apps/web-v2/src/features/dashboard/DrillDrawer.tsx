import { useQuery } from "@tanstack/react-query";
import { derivedSignalQuery } from "./queries";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";

/**
 * A drill-down, SERVER-AUTHORED (`dashboard.spec` #3). The client names a
 * signal and prints what comes back. It does not assemble a field's history
 * from data it happens to be holding — that would be a second, unreviewed
 * source of truth about what happened.
 *
 * The `derived` drill is the one that matters: a correction on a DERIVED field
 * reads as one upstream bug, not as N independent defects. Counting them
 * separately would make a single broken function look like a quality problem
 * across the board (`dashboard.spec` #4).
 */
export function DrillDrawer({
  signal,
  onClose,
}: {
  signal: string;
  onClose: () => void;
}) {
  const { data, isPending, isError } = useQuery(derivedSignalQuery(signal));

  return (
    <aside
      data-testid="drill-drawer"
      className="fixed inset-y-0 right-0 z-(--z-overlay) w-230 max-w-[92vw] overflow-auto bg-surface-panel p-11 shadow-drawer"
    >
      <div className="flex items-start gap-6">
        <div className="flex-1">
          {isPending ? (
            <p className="text-base text-ink-secondary">Loading…</p>
          ) : isError ? (
            <p className="text-base text-state-halt-ink">This drill-down is unavailable.</p>
          ) : (
            <>
              <Eyebrow variant="screen">{data.title}</Eyebrow>
              {data.note ? (
                <p className="mt-4 text-base leading-body text-ink-secondary">{data.note}</p>
              ) : null}
              <ul className="mt-8 flex flex-col gap-5">
                {data.rows.map((row, i) => (
                  <li key={`${row.head}-${i}`} className="border-t border-line-subtle pt-5 first:border-t-0 first:pt-0">
                    <p className="text-md font-semibold text-ink-primary">{row.head}</p>
                    <p className="mt-1 text-base leading-body text-ink-secondary">{row.body}</p>
                    {row.meta ? (
                      <p className="mt-1 font-mono text-xs text-ink-muted">{row.meta}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <Button size="sm" fill="ghost" tone="neutral" onClick={onClose} aria-label="Close">
          ×
        </Button>
      </div>
    </aside>
  );
}
