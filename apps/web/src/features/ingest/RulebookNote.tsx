import type { QuarantineResolved } from "@titlepipe/contract";

/**
 * THE NOTE UNDER THE PAIRED ROW — amber until quarantine passes, then green.
 *
 * ⚠ RULED 2026-08-29 (RULING-2026-08-29.md): the amber copy is the reference's
 * VERBATIM — it is the product's own statement of why jurisdiction stopped
 * being typable (CONFLICT-intake-hand-typed-jurisdiction.md, resolved). The
 * green state prints the SERVER's sentences (`QuarantineResolved.note_*`),
 * because "the rulebook bound" is a server claim the browser has no standing
 * to compose.
 */
export function RulebookNote(props: {
  readonly resolved: QuarantineResolved | null;
}) {
  if (props.resolved === null) {
    return (
      <div
        data-testid="rulebook-note"
        data-state="unbound"
        className="flex flex-col gap-3 rounded-lg border-l-4 border-state-attend-border bg-state-attend-surface p-7"
      >
        <p className="font-sans text-meta font-bold leading-close text-state-attend">
          Rulebook binds after quarantine
        </p>
        <p className="font-sans text-meta leading-body text-ink-secondary">
          Jurisdiction is read from the recorded clerk stamp once the package
          passes optical quarantine, so the state overlay can never be
          hand-picked wrong.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="rulebook-note"
      data-state="bound"
      className="flex flex-col gap-3 rounded-lg border-l-4 border-state-settled-border bg-state-settled-surface p-7"
    >
      <p className="font-sans text-meta font-bold leading-close text-state-settled">
        {props.resolved.note_title}
      </p>
      <p className="font-sans text-meta leading-body text-ink-secondary">
        {props.resolved.note_body}
      </p>
    </div>
  );
}
