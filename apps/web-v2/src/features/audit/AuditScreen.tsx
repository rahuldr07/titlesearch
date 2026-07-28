import { useQuery } from "@tanstack/react-query";
import { auditQuery } from "./queries";
import { AuditRow } from "./AuditRow";
import { AuditFilters } from "./AuditFilters";
import { ScreenTitle } from "../../app/ScreenTitle";

/**
 * THE RECORD. Append-only: who did what, to which order, when, and on what
 * evidence.
 *
 * This screen exists so that "who amended that claim" has an answer. Every
 * consequential act in the product — a corrected value, a confirmed rule, a
 * suspended account — is somebody's signature, and a signature nobody can look
 * up later is not a signature. The value of the record is entirely in its being
 * complete, which is why there is no edit, no delete, and no filter that can
 * quietly drop a row.
 *
 * NO SEARCH BOX, NO PAGINATION, NO SORT. The endpoint returns the record as the
 * server ordered it — newest first — and the client reorders nothing. A sort
 * control on an append-only log invites reading it as a table of facts rather
 * than a sequence of acts, and the sequence is the evidence: what somebody knew
 * when they acted is the row above theirs.
 *
 * ONE ROW PER ENTRY, NEVER GROUPED. Collapsing three corrections by the same
 * person into "R. Delacroix · 3 changes" is exactly the summary that hides the
 * one that mattered.
 */
export function AuditScreen() {
  const { data, isPending, isError } = useQuery(auditQuery);

  if (isError) {
    return <p className="text-base text-state-halt-ink">The record is unavailable.</p>;
  }
  if (isPending) {
    return <p className="text-base text-ink-secondary">Loading the record…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <ScreenTitle>Admin · Audit</ScreenTitle>
        <h1 className="text-3xl font-semibold text-ink-primary">The record</h1>
        <p className="max-w-3xl text-base leading-body text-ink-secondary">
          Append-only: who did what, to which order, when, and on what evidence.
          Read-only — no edit, no delete. This is how &ldquo;who amended that
          claim&rdquo; has an answer.
        </p>
      </header>

      <AuditFilters />

      {data.entries.length === 0 ? (
        <p className="text-base text-ink-secondary">
          Nothing recorded yet. An empty record is a young system, not a clean
          one.
        </p>
      ) : (
        <ul
          data-testid="audit-list"
          className="overflow-hidden rounded-9 border border-line-strong bg-surface-panel"
        >
          {data.entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
