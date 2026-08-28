import { Button, Dialog, DialogBody, DialogFooter } from "../../components/ui";
import { overlayCap } from "../../components/ui/overlaySurface";
import { NoValueChip } from "../../entities/field/NoValueChip";
import { NO_VALUE, type NoValueRender } from "../../entities/field/noValueStates";
import { NA_GUIDE, NA_REASONS } from "./naGuideRows";
import { useOverlayOpen, useOverlays } from "../../app/keyboard/overlays";

/**
 * THE NO-VALUE STATE GUIDE — the states the CONTRACT has, not the states the
 * design drew.
 *
 * The design's card is titled "4-State NA Taxonomy Matrix" and names four
 * states of its own. Those four are close to ours and are NOT ours: see
 * `docs/frontend/design-2026-08/CONFLICT-na-taxonomy.md`, which lays the two
 * side by side. This guide renders `entities/field/noValueStates.ts` — the
 * table every field on every screen already draws from — so what the reader
 * learns here is what the reader will see there.
 *
 * There are FIVE rows, not four. `enums.ts:44-47` is explicit that a null value
 * with a null reason is a fifth distinct render and NOT an enum member; drawing
 * four would teach the reader to collapse the one the rulebook names hardest.
 */
export function NaGuideOverlay() {
  const open = useOverlayOpen("na-guide");
  const close = useOverlays((s) => s.close);

  return (
    <Dialog
      title="No-value states"
      testId="na-guide"
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) close("na-guide");
      }}
    >
      <DialogBody>
        <p className="text-meta leading-body text-ink-secondary">
          Four states about the document, one about the pipeline. They never
          collapse into one dash, and nothing is derived from a null value.
        </p>
        <div className={overlayCap}>
          <div className="flex flex-col gap-6">
            {NA_REASONS.map((render) => (
              <Row key={render} render={render} />
            ))}
            <h3 className="text-label font-bold leading-flat text-ink-muted">
              Not an NA state
            </h3>
            <Row render="not-extracted" />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onPress={() => close("na-guide")}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

function Row({ render }: { readonly render: NoValueRender }) {
  const guide = NA_GUIDE[render];
  const surfaced = NO_VALUE[render].surfacedForReview;

  return (
    <div
      data-na-row={render}
      className="flex flex-col gap-3 rounded-sm border border-line-subtle bg-control-fill p-6"
    >
      <div className="flex items-center justify-between gap-6">
        <NoValueChip render={render} />
        {/* The rulebook's own answer, read rather than re-derived. */}
        <span className="shrink-0 text-label leading-flat text-ink-muted">
          {surfaced ? "Surfaced for review" : "Not surfaced for review"}
        </span>
      </div>
      <p className="text-meta leading-body text-ink-secondary">{guide.when}</p>
      {/* `ink-muted`, not `ink-faint`: 11px faint on control-fill is 3.17:1 and
          fails AA — measured in `overlaySurface.ts`. */}
      <p className="font-mono text-label leading-flat text-ink-muted">{guide.cite}</p>
    </div>
  );
}
