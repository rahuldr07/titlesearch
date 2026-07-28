import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

import { SIGNOFF_DEFAULTS } from "./baseline";

/**
 * Per-client prefill for the intake questions — and nothing more than prefill.
 *
 * The subtitle says "the abstractor still answers every line" because that is
 * the difference between a convenience and a forgery. A default is a
 * suggestion the person answering may overwrite; if it ever became the answer,
 * the sign-off would carry a signature against assertions nobody made, which is
 * the one thing intake exists to prevent.
 *
 * Values are printed in the MONO face and in the action colour: they are
 * machine-set, not written by the person whose name goes on the sign-off.
 */
export function SignoffDefaults({ clientName }: { clientName: string }) {
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
        <ul className="grid gap-4 sm:grid-cols-2">
          {SIGNOFF_DEFAULTS.map((d) => (
            <li
              key={d.key}
              className="flex items-center gap-4 rounded-5 border border-line-strong bg-surface-app px-5 py-3 text-sm"
            >
              <span className="flex-1 leading-close text-ink-secondary">{d.label}</span>
              <span className="font-mono text-xs font-semibold text-action">{d.value}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs leading-body text-ink-muted">
          CONTRACT GAP: no endpoint reads or writes sign-off defaults. These are
          fixtures — the values are not editable here because a suggestion the
          server never received would prefill nothing at intake.
        </p>
      </CardBody>
    </Card>
  );
}
