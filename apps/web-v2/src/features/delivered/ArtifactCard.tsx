import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";

/**
 * The delivered file, as an object rather than a link in a sentence.
 *
 * It is drawn as a document — badge, filename in mono, what it contains — because
 * the thing that went to the client is a FILE, and someone checking a dispute
 * needs to recognise the exact file by name. "Download the report" as inline
 * text loses the name, and the name is the only handle the client and the
 * abstractor share.
 *
 * The subtitle states what the sheet ASSERTS (sign-off completed) and for which
 * product. That pairing is the point: a Call Back Sheet is a declaration, and a
 * declaration whose scope is not stated on its face is not checkable — which is
 * why an unresolved product DROPS the clause rather than printing an empty one.
 * The product is the order's (`Order.product`, 2026-07-30), not this feature's.
 *
 * DOWNLOAD IS DISABLED, and it is disabled honestly. No endpoint returns or
 * serves the artifact (see `demoContent.ts`), so there is nothing to fetch —
 * and a control that looks live and does nothing is worse than one that says it
 * cannot. `Button`'s disabled state is a surface swap, never opacity, so this
 * reads as "not available" and not as "you lack permission".
 */
export function ArtifactCard({
  filename,
  productName,
}: {
  filename: string;
  /** Server-supplied; null when the order has no resolved product. */
  productName: string | null;
}) {
  return (
    <Card className="flex items-center gap-7 p-8 text-left">
      <span
        aria-hidden
        className="flex h-24 w-20 shrink-0 items-center justify-center rounded-2 border border-action-border bg-action-surface font-mono text-micro font-semibold tracking-badge text-action-ink"
      >
        DOCX
      </span>

      <div className="flex-1">
        <div
          data-testid="artifact-name"
          className="font-mono text-md font-medium text-ink-primary"
        >
          {filename}
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">
          Call Back Sheet · sign-off completed
          {productName === null ? null : ` · ${productName}`}
        </p>
      </div>

      {/*
        THE DESIGN'S STEP SITS BETWEEN TWO RUNGS. Download is drawn at 12px with
        8px/14px padding and a 7px radius — larger than `sm` (11px, 6px/10px),
        smaller than `md` (12.5px, 10px/16px). At `md` the control ran ~8px wide
        of the drawing, and that width is exactly what pushed the subtitle onto
        a second line and grew the card. The size prop still carries the rung;
        only the three measured values are restated.
      */}
      <Button
        fill="tinted"
        size="sm"
        className="rounded-7 px-7 py-4 text-sm"
        disabled
        title="No endpoint names or serves the .docx yet — the file cannot be fetched from here."
      >
        Download
      </Button>
    </Card>
  );
}
