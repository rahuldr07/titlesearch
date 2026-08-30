import type { TemplateSampleDoc } from "@titlepipe/contract";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogTrigger,
  InnerPanel,
} from "../../components/ui";

/**
 * A SCOPED SAMPLE CARD AND ITS INSPECTOR.
 *
 * ⚠ RULED 2026-08-29 (RULING-2026-08-29.md): the reference's inspector panels
 * — source id and bounding box, raw extraction snippet, reviewer annotations —
 * are all served on `TemplateSampleDoc` now, so each prints the wire member
 * where the pre-ruling modal named an absent shape. Scoped is still the
 * point: a sample belongs to the client it was drawn for.
 */
export function SampleInspector({
  sample,
  client,
}: {
  readonly sample: TemplateSampleDoc;
  readonly client: string | null;
}) {
  return (
    <DialogTrigger>
      <Button
        variant="ghost"
        size="sm"
        data-testid={`inspect-sample-${sample.id}`}
        className="h-auto justify-start p-0 text-left"
      >
        <span className="flex w-full flex-col gap-1 rounded-lg border border-line-strong bg-surface-panel p-4">
          <span className="truncate font-sans text-label leading-close font-semibold text-ink-primary">
            {sample.name}
          </span>
          <span className="flex items-baseline justify-between font-mono text-label leading-flat text-ink-muted">
            <span>{`${String(sample.blocks_extracted)} blocks extracted`}</span>
            <span className="font-semibold text-ink-secondary">{`p.${String(sample.page)}`}</span>
          </span>
        </span>
      </Button>
      <Dialog title={sample.name}>
        <DialogBody>
          <p data-testid="sample-inspector" className="font-sans text-meta leading-close text-ink-secondary">
            {client !== null && (
              <>
                {"Client "}
                <span className="font-semibold text-ink-primary">{client}</span>
                {" · "}
              </>
            )}
            {`Ingested ${sample.uploaded} · Page ${String(sample.page)}`}
          </p>

          <InnerPanel padding="tight">
            <div className="flex flex-col gap-6">
              <SampleFact label="Source id & bounding box">
                {/* Rule 3: a doc id and a box are citations — mono. */}
                <span className="font-mono">{`${sample.doc_id} · ${sample.box}`}</span>
              </SampleFact>
              <SampleFact label="Raw extraction snippet">
                <span className="block rounded-md border border-line-subtle bg-surface-panel p-4 font-mono text-label leading-body text-ink-primary">
                  “{sample.snippet}”
                </span>
              </SampleFact>
              <SampleFact label="Reviewer annotations">{sample.notes}</SampleFact>
            </div>
          </InnerPanel>
        </DialogBody>
        <DialogFooter>
          <Button slot="close">Close inspector</Button>
        </DialogFooter>
      </Dialog>
    </DialogTrigger>
  );
}

function SampleFact({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-sans text-label leading-flat font-bold text-ink-muted">{label}</span>
      <span className="font-sans text-meta leading-body text-ink-primary">{children}</span>
    </div>
  );
}
