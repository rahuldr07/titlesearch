import type { CompositionResponse } from "@titlepipe/contract";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from "../../components/ui";

/**
 * THE DESIGN'S "JSON — inspect the compiled report data".
 *
 * The prototype pairs it with a PDF button in one segmented control at the foot
 * of the compiler. Only this half is drawn, and the other half's absence is a
 * refusal rather than an oversight:
 *
 * PDF. `CompositionResponse` names no artifact — no href, no filename, no
 * digest of a file. The nearest surface is `GET /api/orders/{id}/artifacts`,
 * and it is scoped to the order rather than to THIS composition: on an
 * unreleased sheet it answers with the rows of whatever version was already
 * delivered. A download button that hands back the PREVIOUS version while the
 * page above it reads "draft — not released" is worse than no button.
 * CONTRACT GAP: `CompositionResponse.artifact: Artifact | null` (design.ts:121)
 * would close it — the file this composition produced, or null until one does.
 *
 * JSON needs nothing new. It is the parsed response this screen already holds,
 * printed. Nothing is composed, filtered or relabelled on the way out, which is
 * the point of the affordance: it is how a reader checks that what the sheet
 * says is what the server sent.
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
          {/* Rule 3: a wire payload is data. It scrolls in its own box — the
              page body never scrolls sideways. */}
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
