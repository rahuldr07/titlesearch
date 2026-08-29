import type { TemplateSample } from "@titlepipe/contract";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogTrigger,
  InnerPanel,
} from "../../components/ui";
import { SpecAbsent } from "./SpecDetail";

/**
 * THE SAMPLE INSPECTOR.
 *
 * `TemplateSample` is four fields — `client_id`, `client`, `shape`, `lines` —
 * and all four are printed. The design's three panels read a source id and
 * bounding box, a raw extraction snippet and reviewer annotations, none of
 * which exist on the wire, so each is drawn absent with the shape it wants.
 *
 * `DialogTrigger` owns the open state, so Escape closes and focus returns to
 * this button; the overlay carries `data-chord-scope="own"` from `dialog.tsx`,
 * which is what stands the global chord vocabulary down while it is up.
 */
export function SampleInspector({ sample }: { readonly sample: TemplateSample }) {
  return (
    <DialogTrigger>
      <Button variant="ghost" size="sm" data-testid={`inspect-sample-${sample.client_id}`}>
        Inspect
      </Button>
      <Dialog title={`Sample inspector — ${sample.client}`}>
        <DialogBody>
          <div data-testid="sample-inspector" className="flex flex-col gap-3">
            <span className="font-sans text-subject leading-close font-bold text-ink-primary">
              {sample.client}
            </span>
            <span className="font-sans text-meta leading-close text-ink-secondary">
              {"Client "}
              <span className="font-mono">{sample.client_id}</span>
              {" · shape "}
              <span className="font-mono font-semibold text-ink-primary">{sample.shape}</span>
              {" · "}
              <span className="font-mono tabular-nums font-semibold text-ink-primary">
                {sample.lines}
              </span>
              {" lines"}
            </span>
          </div>

          <InnerPanel padding="tight">
            <div className="flex flex-col gap-6">
              <SpecAbsent
                testId="sample-box-absent"
                label="Source id and bounding box"
                shape="TemplateSample.source_id: string, TemplateSample.bbox: { page, x, y, w, h }"
                why="A box drawn from anything else points at a region of a page nobody located."
              />
              <SpecAbsent
                testId="sample-snippet-absent"
                label="Raw extraction snippet"
                shape="TemplateSample.snippet: { source_id: string; text: string }"
                why="A quotation without the source it was taken from is a value with no citation, and the source id is part of the snippet, not beside it."
              />
              <SpecAbsent
                testId="sample-notes-absent"
                label="Reviewer annotations"
                shape="TemplateSample.annotations: { reviewer, note, at }[]"
                why="An annotation names who wrote it; there is no reviewer on this record to attribute one to."
              />
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
