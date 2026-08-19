import { Eyebrow } from "../../shared/ui/Eyebrow";
import { NOT_WIRED, VERSIONS } from "./designFixture";

/**
 * VERSIONS · IMMUTABLE.
 *
 * The version list IS the defect record, and that is why it is never collapsed
 * to "current". A v2 existing at all means v1 was wrong or too broad, and the
 * note beside it — "Scope narrowed to Arizona only" — is the only surviving
 * explanation for every report written while v1 was live. Showing only the
 * latest version would erase the evidence that the earlier one applied.
 *
 * NO EDIT AFFORDANCE, EVER. A version log you can amend is not a log. Changing
 * a rule writes a new version; nothing here rewrites an old one, which is the
 * same append-only discipline the audit record follows.
 *
 * CONTRACT GAP: `Rule` carries a `version` integer and nothing else — no
 * history, no note, no author, no date, and there is no versions endpoint. The
 * rows below are the design's and are captioned as such.
 */
export function VersionLog() {
  return (
    <section data-testid="rule-versions" className="border-t border-line-subtle pt-7">
      <Eyebrow variant="field" as="h3">
        Versions · immutable
      </Eyebrow>

      <ul className="mt-4 flex flex-col gap-1">
        {VERSIONS.map((entry) => (
          <li key={entry.v} className="flex flex-wrap items-baseline gap-5 py-2 text-xs">
            <span className="font-mono font-semibold text-ink-primary">{entry.v}</span>
            <span className="flex-1 text-ink-secondary">{entry.note}</span>
            <span className="text-ink-muted">
              {entry.who} · {entry.when}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs leading-body text-ink-muted">{NOT_WIRED}</p>
    </section>
  );
}
