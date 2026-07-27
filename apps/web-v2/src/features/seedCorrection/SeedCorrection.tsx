import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { goldenQuery } from "./queries";
import { SeedRecord } from "./SeedRecord";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * SEED CORRECTION — the only place in the system where ground truth changes.
 *
 * IT HAS NO MENU ENTRY AND NO PICKER (`navigation.spec` #5). You arrive here
 * from a bench failure, carrying the field with you, or you do not arrive. A
 * picker would make this a screen you can browse, and browsing the golden set
 * looking for something to fix is how a seed set drifts.
 *
 * THREE URL STATES, and they are deliberately different from each other:
 * no context at all is a MISSING LINK; an id nobody recognises is a STALE one.
 * Collapsing them would tell someone chasing a three-week-old bench link that
 * they navigated wrong, when in fact the seed they were sent to has moved.
 */
export function SeedCorrection() {
  const { fieldId } = useSearch({ from: "/seed-correction" });
  const { data, isPending, isError } = useQuery(goldenQuery);

  if (fieldId === "") {
    return (
      <Card data-testid="no-context" accent="attend">
        <CardBody className="flex flex-col gap-4">
          <Eyebrow variant="screen">Seed correction</Eyebrow>
          <p className="max-w-2xl text-base leading-body text-ink-secondary">
            This screen has no menu entry. It opens one field, one document, one
            record — and it only opens from the failure that raised the question.
          </p>
          <p className="max-w-2xl text-base leading-body text-ink-secondary">
            Open a failing row on bench results and follow{" "}
            <span className="font-semibold">Investigate seed →</span>. There is
            no picker here on purpose: browsing the golden set for something to
            correct is how a seed set drifts.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (isPending) return <p className="text-base text-ink-secondary">Loading the seed…</p>;
  if (isError) {
    return <p className="text-base text-state-halt-ink">The golden set is unavailable.</p>;
  }

  const field = data.golden_fields.find((candidate) => candidate.id === fieldId);

  if (field === undefined) {
    return (
      <Card data-testid="stale-link" accent="halt">
        <CardBody className="flex flex-col gap-4">
          <Eyebrow variant="screen">Stale link</Eyebrow>
          <p className="max-w-2xl text-base leading-body text-ink-secondary">
            The golden set has no field <code className="font-mono">{fieldId}</code>.
            The link you followed is older than the seed it points at — the field
            was removed, or the run that produced it has been superseded.
          </p>
          <p className="max-w-2xl text-base leading-body text-ink-secondary">
            Re-open the failure from the current bench run rather than editing
            the id in the address bar.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Eyebrow variant="screen">Seed correction</Eyebrow>
        <p className="max-w-3xl text-base leading-body text-ink-secondary">
          The only place in the system where ground truth changes — one field,
          one document, one record. No bulk operations exist.
        </p>
      </header>
      <SeedRecord field={field} />
    </div>
  );
}
