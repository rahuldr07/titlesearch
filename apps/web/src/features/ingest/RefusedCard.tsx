import type { IngestRejection } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { glossFor } from "./manifest";

/**
 * THE SERVER'S REFUSAL, PRINTED AS THE SERVER SENT IT.
 *
 * INVARIANTS 60-61 (`docs/INVARIANTS.md`, §4.3): "an incomplete upload renders
 * the server's missing-field list verbatim; the client does not author the
 * list." Every structural decision here follows from that one sentence:
 *
 *   - The rows are `rejection.missing_fields.map(...)`. Not `MANIFEST` filtered
 *     by what looks empty, not the union of both. If the server names six
 *     fields, six rows appear; if it names one this screen has never heard of,
 *     that one row appears, spelled the way the server spelled it.
 *   - `rejection.reason` is rendered as a whole sentence, unedited. No prefix,
 *     no "Error:", no appended period. `shared/notify.ts` carries the same rule
 *     for toasts and the reason is identical: improving the server's sentence
 *     belongs in the server.
 *   - `glossFor` may add the screen's own explanation BESIDE a key. It can
 *     never remove a key, reorder the list, or supply one the server omitted —
 *     and where it knows nothing, the raw key stands alone rather than being
 *     dressed up.
 *
 * The way out is back to the form with everything still typed. A refusal that
 * clears the form is a refusal that costs the operator the work twice.
 */
export function RefusedCard(props: {
  readonly rejection: IngestRejection;
  readonly fileName: string;
  readonly onBack: () => void;
}) {
  return (
    <div
      data-testid="refused-card"
      className="flex flex-col gap-6 rounded-lg border border-state-halt-border bg-surface-panel p-12 shadow-card"
    >
      <div className="flex flex-wrap items-baseline gap-6">
        <h2 className="font-sans text-subject font-semibold leading-tight text-state-halt">
          Refused
        </h2>
        <span className="font-mono text-meta leading-close text-ink-muted">
          {props.fileName}
        </span>
      </div>

      {/* The server's words. Verbatim, and the whole sentence. */}
      <p
        data-testid="refusal-reason"
        className="font-sans text-body leading-body text-ink-primary"
      >
        {props.rejection.reason}
      </p>

      <ul className="flex flex-col">
        {props.rejection.missing_fields.map((key) => {
          const gloss = glossFor(key);
          return (
            <li
              key={key}
              data-testid="missing-field"
              className="grid grid-cols-[170px_minmax(0,1fr)] items-baseline gap-6 border-b border-line-subtle py-5"
            >
              {/* The server's key, or this screen's label for it. Never a
                  substitute for one the server did not send. */}
              <span className="font-mono text-label font-semibold leading-airy text-state-halt">
                {gloss?.label ?? key}
              </span>
              <span className="font-sans text-meta leading-body text-ink-secondary">
                {gloss?.why ?? "Required by the order contract."}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="font-sans text-meta leading-body text-ink-secondary">
        This refusal is protection, not pedantry. A package missing its order
        identity does not fail at upload — it fails four stages later, silently,
        as a wrong value on a delivered report.
      </p>

      <Button
        data-testid="refused-back"
        onPress={props.onBack}
        className="w-fit"
      >
        Back — attach what is missing
      </Button>
    </div>
  );
}
