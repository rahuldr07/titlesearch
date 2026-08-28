import type { CompletenessGap } from "@titlepipe/contract";

/**
 * One gap the gate raised. `GapCloseOption` is a READ SHAPE ONLY — no write
 * exists for any of them (`intake.ts:118-120`), so each option is stated with
 * the server's own consequence sentence and there is no button.
 */
export function GapRow(props: { readonly gap: CompletenessGap }) {
  const gap = props.gap;

  return (
    <li
      data-gap={gap.id}
      data-gap-kind={gap.kind}
      className="flex flex-col gap-5 rounded-lg bg-surface-panel p-8"
    >
      <div className="flex items-baseline gap-5">
        <span aria-hidden className="font-mono text-meta leading-flat text-state-attend">
          ◆
        </span>
        {/* `line_number` is a read field so the reader can get back to the line
            they answered — matching on prose would be a join (`intake.ts:151`). */}
        <span className="font-mono text-label leading-flat tabular-nums text-ink-muted">
          Line {gap.line_number}
        </span>
        <span className="text-meta font-semibold leading-close text-ink-primary">
          {gap.line_label}
        </span>
        <span className="ml-auto font-mono text-label leading-flat text-ink-muted">
          {gap.kind}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-12 gap-y-3">
        <Side term="The sign-off claimed" body={gap.claim} />
        <Side term="The package shows" body={gap.evidence} />
      </dl>

      {gap.closed_by === null ? (
        <div className="flex flex-col gap-3">
          <span className="text-label font-bold leading-flat text-ink-muted">
            What the server says could close it
          </span>
          {gap.close_options.map((option) => (
            <p key={option.kind} className="text-meta leading-body text-ink-secondary">
              <span className="font-semibold text-ink-primary">{option.label}</span> —{" "}
              {option.consequence}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-meta leading-body text-ink-secondary">
          Closed by {gap.closed_by}
          {gap.closed_note === null ? "" : ` — ${gap.closed_note}`}
        </p>
      )}
    </li>
  );
}

function Side(props: { readonly term: string; readonly body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-label font-bold leading-flat text-ink-muted">{props.term}</dt>
      <dd className="text-meta leading-body text-ink-primary">{props.body}</dd>
    </div>
  );
}
