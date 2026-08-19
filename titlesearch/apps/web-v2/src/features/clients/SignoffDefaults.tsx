import type { ConfigLine } from "@titlepipe/contract";

import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * Per-client prefill for the intake questions — and nothing more than prefill.
 *
 * The subtitle says "the abstractor still answers every line" because that is
 * the difference between a convenience and a forgery. A default is a
 * suggestion the person answering may overwrite; if it ever became the answer,
 * the sign-off would carry a signature against assertions nobody made, which is
 * the one thing intake exists to prevent.
 *
 * The map is SPARSE and is rendered sparse. Only the lines the server carries a
 * default for are listed; padding the rest with an assumed YES would put
 * suggestions on the screen that intake would never actually prefill.
 *
 * Values are printed in the MONO face and in the action colour: they are
 * machine-set, not written by the person whose name goes on the sign-off.
 *
 * THE CHIP TRACK IS SIZED, NOT COUNTED (`grid-autofill-230`, the export's
 * `repeat(auto-fill,minmax(230px,1fr))`). A chip is a label and its value, and
 * the pair only reads as a pair while the two stay close together. At a fixed
 * two columns the 880px measure gave each chip ~430px and stranded the mono
 * value at the far edge, so pairing "L08 · Mortgage covering additional
 * property" with its "N/A" became a tracking exercise across white space —
 * and a prefill read against the wrong line is a prefill nobody checked.
 * Auto-fill lets the column count follow the measure, as designed.
 */
export function SignoffDefaults({
  clientName,
  defaults,
  lines,
}: {
  clientName: string;
  defaults: Readonly<Record<string, string>>;
  lines: readonly ConfigLine[];
}) {
  const entries = Object.entries(defaults).map(([lineId, value]) => {
    const line = lines.find((l) => l.id === lineId);
    return {
      key: lineId,
      label: line === undefined ? lineId : `${lineId} · ${line.label}`,
      value,
    };
  });

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <Eyebrow variant="section" as="h2">Sign-off suggestion defaults</Eyebrow>
        <p className="text-xs leading-body text-ink-secondary">
          Prefill the intake questions for {clientName} —{" "}
          <span className="font-semibold">the abstractor still answers every line.</span>
        </p>
      </CardHeader>
      <CardBody>
        {entries.length === 0 ? (
          <p data-testid="no-defaults" className="text-sm leading-body text-ink-secondary">
            No prefill defaults. Every line reaches this client&rsquo;s intake
            unanswered.
          </p>
        ) : (
          <ul className="grid grid-autofill-230 gap-4">
            {entries.map((d) => (
              <li
                key={d.key}
                data-testid={`default-${d.key}`}
                className="flex items-center gap-4 rounded-5 border border-line-strong bg-surface-app px-5 py-3 text-sm"
              >
                <span className="flex-1 leading-close text-ink-secondary">{d.label}</span>
                <span className="font-mono text-xs font-semibold text-action">{d.value}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-5 text-xs leading-body text-ink-muted">
          CONTRACT GAP: defaults are served read-only — the values are not
          editable here, because a suggestion the server never received would
          prefill nothing at intake.
        </p>
      </CardBody>
    </Card>
  );
}
