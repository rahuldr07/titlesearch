import type { LifecycleStage } from "@titlepipe/contract";
import { StageColumn } from "./StageColumn";

/**
 * Seven columns, equal width, side by side — ALL OF THEM ON SCREEN AT ONCE.
 *
 * The comparison BETWEEN columns is the entire point, so every column has to be
 * visible without moving anything. This previously carried a 1190px minimum
 * inside a container that is 764px wide, which meant the board silently
 * overflowed by more than two columns on EVERY window size: Escalated was cut
 * in half and Delivered was off-screen entirely, reachable only by a horizontal
 * scroll with no visible affordance. A board you have to scroll to finish
 * reading has already lost the comparison it exists for, and one that hides its
 * last stages is worse than a list — it is a board that lies about the shape of
 * the pipeline.
 *
 * So the columns fit the space they are given: `grid-cols-7` is
 * `repeat(7, minmax(0, 1fr))`, and the `minmax(0, …)` is what lets a column
 * shrink below its content instead of pushing the grid wide again. Below the
 * width where seven columns stay legible the screen switches to the rail
 * outright rather than scrolling; see useNarrowViewport.
 *
 * `items-start` so a column with one card does not stretch to match the tallest
 * one. Equal-height columns would imply the stages are comparable in volume,
 * which they are not and are not meant to be.
 */
export function StageBoard({ stages }: { stages: readonly LifecycleStage[] }) {
  return (
    <div className="grid grid-cols-7 items-start gap-3">
      {stages.map((stage) => (
        <StageColumn key={stage.id} stage={stage} />
      ))}
    </div>
  );
}
