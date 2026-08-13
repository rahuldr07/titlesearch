import type { LifecycleStage } from "@titlepipe/contract";
import { StageColumn } from "./StageColumn";

/**
 * Seven columns, equal width, side by side — ALL OF THEM ON SCREEN AT ONCE.
 *
 * The comparison BETWEEN columns is the entire point, so every column has to be
 * visible without moving anything. The export wraps this board in
 * `overflow-x:auto` behind a 1190px minimum, and we do not: that scrollbar had
 * no affordance, and at the shell's own measure it cut Escalated in half and
 * put Delivered off-screen entirely. A board you have to scroll to finish
 * reading has already lost the comparison it exists for, and one that hides its
 * last stages is worse than a list — it is a board that lies about the shape of
 * the pipeline.
 *
 * So `grid-cols-7` stands — `repeat(7, minmax(0, 1fr))`, where the
 * `minmax(0, …)` is what lets a column shrink below its content instead of
 * pushing the grid wide again — and the RAIL THRESHOLD moves instead. Below the
 * export's own 1190px the screen switches to the rail outright rather than
 * squeezing seven columns under their drawn width; see `useNarrowViewport`.
 *
 * `items-start` so a column with one card does not stretch to match the tallest
 * one. Equal-height columns would imply the stages are comparable in volume,
 * which they are not and are not meant to be.
 */
export function StageBoard({ stages }: { stages: readonly LifecycleStage[] }) {
  return (
    <div className="grid grid-cols-7 items-start gap-5">
      {stages.map((stage) => (
        <StageColumn key={stage.id} stage={stage} />
      ))}
    </div>
  );
}
