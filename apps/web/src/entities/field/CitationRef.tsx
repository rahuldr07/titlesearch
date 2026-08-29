import type { Citation } from "../../shared/provenance";
import { cx } from "../../components/ui";

/**
 * A CITATION, AND IT IS ALWAYS MONO.
 *
 * Rule 3: "Mono (--font-data) is for data only: order refs, money, citations,
 * hashes, timestamps, kbd." A citation is the canonical case, so this component
 * takes no typography props at all — there is no way to render one in the sans
 * face, which is the enforcement.
 *
 * `Citation` has both members or it is not a citation (`provenance.ts:26`), so
 * there is no "missing page" branch here. A half-citation never reaches this
 * component: `readCited` classified it as `uncited` several layers up and
 * `FieldValueView` renders it as the defect it is.
 *
 * The snippet is the server's, verbatim. It is not trimmed, ellipsised at a
 * word boundary, or re-cased — an excerpt a reviewer cannot trust to be exactly
 * what the page says is not evidence.
 */
export type CitationRefProps = {
  readonly citation: Citation;
  /**
   * Jump to this citation in the evidence pane (design §Screens 7,
   * "click/Z zoom-to-citation"). Absent renders the citation as a plain
   * reference — a record, not an affordance.
   */
  readonly onOpen?: ((citation: Citation) => void) | undefined;
  readonly className?: string | undefined;
};

const REF = "font-mono text-label leading-flat text-ink-muted tabular-nums";

export function CitationRef({ citation, onOpen, className }: CitationRefProps) {
  const label = `${citation.docId} p.${citation.page}`;

  if (onOpen === undefined) {
    return (
      <span className={cx(REF, "inline-flex items-baseline gap-3", className)}>
        <span>{label}</span>
        <CitationSnippet snippet={citation.snippet} />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(citation)}
      data-citation-doc={citation.docId}
      data-citation-page={citation.page}
      aria-label={`Open ${label} in the evidence pane`}
      className={cx(
        REF,
        "tp-state relative inline-flex cursor-pointer items-baseline gap-3 rounded-xs",
        "border-0 bg-transparent p-0 text-left",
        // WCAG 2.2 §2.5.8: the drawn text is one 11px line, the hit area is
        // not — the `after:` pseudo grows the target past 24px without the
        // citation gaining padding it must not show. The same mechanism as
        // checkbox/switch/radio-group; `relative` is load-bearing (see
        // `radio-group.tsx` — an absolute inset with no positioned ancestor
        // lands on the wrong box).
        "after:absolute after:-inset-x-2 after:-inset-y-4",
        "hover:text-action hover:underline",
        className,
      )}
    >
      <span>{label}</span>
      <CitationSnippet snippet={citation.snippet} />
    </button>
  );
}

/**
 * The snippet is optional ON THE CITATION, and its absence is not an absence of
 * provenance — the doc and page still locate the value. So it renders nothing
 * rather than a placeholder; rule 14's typed absence governs FIELD VALUES, and a
 * snippet is not one.
 */
function CitationSnippet({ snippet }: { readonly snippet: string | null }) {
  if (snippet === null) return null;
  return <span className="truncate text-ink-muted">“{snippet}”</span>;
}
