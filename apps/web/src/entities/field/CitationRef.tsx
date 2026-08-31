import type { Citation } from "../../shared/provenance";
import { cx } from "../../components/ui";

/**
 * A citation, always mono — no typography props, so there is no way to
 * render one in the sans face. A half-citation never reaches this component:
 * readCited classified it as `uncited` several layers up. The snippet is the
 * server's, verbatim — never trimmed, ellipsised or re-cased, because an
 * excerpt a reviewer cannot trust to be exactly what the page says is not
 * evidence.
 */
export type CitationRefProps = {
  readonly citation: Citation;
  /**
   * Jump to this citation in the evidence pane. Absent renders the citation
   * as a plain reference — a record, not an affordance.
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
        // WCAG 2.2 §2.5.8: the `after:` pseudo grows the target past 24px
        // without the citation gaining padding it must not show. `relative`
        // is load-bearing — an absolute inset with no positioned ancestor
        // lands on the wrong box (see radio-group.tsx).
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
 * The snippet is optional on the citation, and its absence is not an absence
 * of provenance — the doc and page still locate the value, so it renders
 * nothing rather than a placeholder.
 */
function CitationSnippet({ snippet }: { readonly snippet: string | null }) {
  if (snippet === null) return null;
  return <span className="truncate text-ink-muted">“{snippet}”</span>;
}
