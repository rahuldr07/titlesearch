import type { CompositionResponse } from "@titlepipe/contract";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from "../../components/ui";

/**
 * Only the JSON half of the design's JSON/PDF pair is drawn. PDF is a
 * deliberate absence: `CompositionResponse` names no artifact, and the
 * artifacts endpoint is order-scoped, not composition-scoped — on an
 * unreleased sheet it would hand back the previously delivered version under
 * a page reading "draft". CONTRACT GAP:
 * `CompositionResponse.artifact: Artifact | null` would close it.
 *
 * JSON needs nothing new — it is the parsed response this screen already
 * holds, printed unfiltered, so a reader can check that what the sheet says
 * is what the server sent.
 */
export function CompositionJson({ composed }: { readonly composed: CompositionResponse }) {
  return (
    <DialogTrigger>
      <Button variant="ghost" size="sm" data-testid="composition-json-open">
        JSON
      </Button>
      <Dialog title={`Compiled report data — ${composed.order_id}`} testId="composition-json">
        <DialogBody>
          <p className="font-sans text-meta leading-body text-ink-secondary">
            The composition read for this order, exactly as it arrived and
            exactly as the sheet above was drawn from it. Nothing here is
            recomputed by this screen.
          </p>
          {/* Scrolls in its own box — the page body never scrolls sideways. */}
          <pre
            data-testid="composition-json-body"
            className="max-h-160 overflow-auto rounded-md border border-line-subtle bg-surface-sunken p-8 font-mono text-label leading-body text-ink-secondary"
          >
            {JSON.stringify(composed, null, 2)}
          </pre>
        </DialogBody>
        <DialogFooter>
          <Button slot="close">Close</Button>
        </DialogFooter>
      </Dialog>
    </DialogTrigger>
  );
}
