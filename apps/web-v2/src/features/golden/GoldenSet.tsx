import { useState } from "react";
import { CAPTURE_SECTIONS } from "./roster";
import { CaptureRow } from "./CaptureRow";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

const ORDER = "26-04490";

/**
 * GOLDEN SET — CAPTURE.
 *
 * THE PIPELINE'S DRAFT IS NOT ON THIS SCREEN (`golden.spec` #1) — not greyed
 * out, not behind a toggle, not one keystroke away. A draft you can see is a
 * draft you will agree with, and a seed set built by agreeing with the machine
 * measures the machine against itself. The typist is producing the answer the
 * machine will be graded against, so the answer cannot be in the room.
 *
 * THERE IS NO CLOCK HERE (`golden.spec` #2). Every other seat in the product
 * has a queue behind it; this one does not, and the screen says so: reading the
 * whole package slowly is the work, not an overrun. A count-up on this screen
 * would quietly convert careful reading into a rate to beat, which is exactly
 * how a seed set stops being ground truth.
 *
 * DESIGNED SHAPE — the capture exports a fixture the test suite consumes
 * directly. There is no submit endpoint yet, and inventing one would be
 * inventing backend behaviour from a screen.
 */
export function GoldenSet() {
  const [values, setValues] = useState<Record<string, string>>({});

  // A cleared field LEAVES THE FIXTURE rather than sitting in it as "". An
  // empty string is a value the test suite would grade against; an absent key
  // is a field nobody has answered yet, which is the truth.
  const set = (code: string, value: string | undefined) => {
    setValues((prev) =>
      Object.fromEntries(
        Object.entries({ ...prev, [code]: value }).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
    );
  };

  const fixture = JSON.stringify({ order: ORDER, pass: "A", fields: values }, null, 2);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Eyebrow variant="screen">Golden set — capture</Eyebrow>
        <p className="font-mono text-xs text-ink-muted">
          order 12 of 50 · {ORDER} · Clayton Co. · 41 pp
        </p>
        <p className="max-w-3xl text-base leading-body text-ink-secondary">
          {
            "You never see the pipeline's draft here — not greyed out, not behind a toggle. A draft you can see is a draft you will agree with, and then this measures nothing. You are typing the answer the machine will be graded against."
          }
        </p>
        <p className="text-xs text-ink-muted">
          read freely — this is reading, not queue-clearing
        </p>
      </header>

      {CAPTURE_SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader filled>
            <Eyebrow variant="section">{section.title}</Eyebrow>
          </CardHeader>
          <CardBody className="p-0">
            {section.fields.map((field) => (
              <CaptureRow
                key={field.code}
                field={field}
                value={values[field.code]}
                onChange={(value) => set(field.code, value)}
              />
            ))}
          </CardBody>
        </Card>
      ))}

      <Card accent="action">
        <CardHeader filled>
          <Eyebrow variant="section">
            What you are building — structured from the first keystroke
          </Eyebrow>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <pre
            data-testid="fixture-line"
            className="overflow-x-auto rounded-4 bg-surface-sunken p-6 font-mono text-xs leading-close text-ink-primary"
          >
            {fixture}
          </pre>
          <p className="text-xs text-ink-muted">
            → fixtures/order-{ORDER}.A.json — consumed by the test suite
            directly. No transcription step, no Word document, no new source of
            error.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
