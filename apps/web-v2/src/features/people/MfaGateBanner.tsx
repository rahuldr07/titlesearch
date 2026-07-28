import { Card, CardBody } from "../../shared/ui/Card";

/**
 * The MFA banner, drawn exactly as designed and wired to nothing.
 *
 * OPEN RULING (Q16): the design's copy calls this "a production gate", but
 * whether that is ENFORCED — a privileged account without MFA is refused at the
 * door — or ADVISORY — it is named here and someone acts on it — has not been
 * settled. The two readings need different machinery and different failure
 * modes, so building either one now would settle the question by accident.
 *
 * So this component states the fact and stops. It has no refusal, no lockout,
 * no countdown and no link to a remediation flow. When the ruling lands, one of
 * those gets added here on purpose rather than being discovered in the code.
 *
 * The count arrives as a server figure; this component never counts rows.
 */
export function MfaGateBanner({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Card
      role="status"
      className="border-state-halt-border bg-state-halt-surface border-l-(length:--stroke-severity) border-l-state-halt"
    >
      <CardBody className="flex items-center gap-6 px-8 py-6">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-state-halt text-md font-bold text-ink-on-action"
        >
          !
        </span>
        <p className="text-base leading-body text-state-halt-ink">
          <span className="font-bold">
            {count} privileged account without MFA.
          </span>{" "}
          Admin, engineer, senior and ops accounts must have MFA — this is a
          production gate.
        </p>
      </CardBody>
    </Card>
  );
}
