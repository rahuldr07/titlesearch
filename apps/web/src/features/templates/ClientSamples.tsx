import type { TemplateSample } from "@titlepipe/contract";
import { Card, CardHeader, CardBody, Empty, InnerPanel } from "../../components/ui";
import { SampleInspector } from "./SampleInspector";

/**
 * SCOPED CLIENT SAMPLES — one sample per client, and scoped is the point: a
 * sample belongs to the client it was drawn for and is never shown as evidence
 * for another. `Inspect` opens the sample inspector, which prints the four
 * fields this record has and names the shapes the design's other panels want.
 */
export function ClientSamples({ samples }: { readonly samples: readonly TemplateSample[] }) {
  return (
    <Card padding="none">
      <CardHeader>
        <span>Scoped client samples</span>
      </CardHeader>
      <CardBody>
        {samples.length === 0 ? (
          <Empty
            title="No samples"
            reason="No client sample is scoped to this shape. That is the server's answer, not a filter applied here."
          />
        ) : (
          <ul className="flex flex-col gap-6">
            {samples.map((sample) => (
              <li key={sample.client_id}>
                <InnerPanel padding="tight">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-sans text-meta leading-close font-semibold text-ink-primary">
                        {sample.client}
                      </span>
                      <SampleInspector sample={sample} />
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                      {/* Rule 3: the client key and the shape letter are identifiers. */}
                      <span className="font-mono text-label leading-flat text-ink-muted">
                        {sample.client_id}
                      </span>
                      <span className="font-sans text-label leading-flat text-ink-secondary">
                        Shape{" "}
                        <span className="font-mono font-semibold text-ink-primary">
                          {sample.shape}
                        </span>{" "}
                        &middot;{" "}
                        <span className="font-mono tabular-nums font-semibold text-ink-primary">
                          {sample.lines}
                        </span>{" "}
                        lines
                      </span>
                    </div>
                  </div>
                </InnerPanel>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
