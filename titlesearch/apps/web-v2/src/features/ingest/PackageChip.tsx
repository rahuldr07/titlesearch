import { Card } from "../../shared/ui/Card";

/**
 * The file the person just chose, drawn as its own sheet under the drop zone.
 *
 * It is a separate card rather than a line inside the zone because it is a
 * different kind of statement: the zone is an invitation, this is a receipt for
 * something now in hand. The design gives it the page glyph, the filename in
 * mono, and one line of detail underneath — mono because a filename is a string
 * people compare character by character against a request.
 *
 * SOLID, WHERE THE ZONE ABOVE IS DASHED. Both are `Card` now, and the whole
 * difference is that one prop. Dashed means nothing is here yet; solid means
 * something is. Drawing the receipt dashed as well would leave the two
 * indistinguishable at the only moment they are ever on screen together.
 *
 * CONTRACT GAP: the design also prints a page count, a readability verdict and
 * a READY stamp on this card. All three are findings about the FILE, produced
 * by the server once it has opened the PDF, and none of them is in any response
 * shape. Counting pages in the browser would be the client asserting a fact
 * about a document it has not processed — which is exactly the invention the
 * refusal rule exists to stop. The size is the one figure the browser genuinely
 * holds, so it is the one figure printed.
 */
export function PackageChip({ file }: { file: File }) {
  return (
    <Card className="flex items-center gap-7 px-8 py-7">
      <span
        aria-hidden
        className="flex h-21 w-17 shrink-0 flex-col justify-end gap-1 rounded-3 border border-action-border bg-action-surface p-3"
      >
        <span className="h-0.5 rounded-pill bg-action-border" />
        <span className="h-0.5 w-3/4 rounded-pill bg-action-border" />
        <span className="h-0.5 rounded-pill bg-action-border" />
      </span>
      <span className="flex min-w-0 flex-col gap-2">
        <span className="truncate font-mono text-xs text-ink-primary">{file.name}</span>
        <span className="text-tiny leading-body text-ink-muted">
          {(file.size / 1_000_000).toFixed(1)} MB · page count and readability are the
          server&rsquo;s findings, after upload
        </span>
      </span>
    </Card>
  );
}
