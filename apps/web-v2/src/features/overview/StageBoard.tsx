import { StageColumn } from "./StageColumn";
import type { LifecycleStage } from "./lifecycle";

/**
 * Seven columns, equal width, side by side.
 *
 * The grid is fixed at seven and the container scrolls rather than reflowing,
 * because the comparison BETWEEN columns is the entire point — a board that
 * wraps to two rows stops being a board and becomes a list with extra steps.
 * When the window is too narrow for that comparison to survive, the screen
 * switches to the rail instead of scrolling; see useNarrowViewport.
 *
 * `items-start` so a column with one card does not stretch to match the tallest
 * one. Equal-height columns would imply the stages are comparable in volume,
 * which they are not and are not meant to be.
 */
export function StageBoard({ stages }: { stages: readonly LifecycleStage[] }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="grid min-w-595 grid-cols-7 items-start gap-4">
        {stages.map((stage) => (
          <StageColumn key={stage.id} stage={stage} />
        ))}
      </div>
    </div>
  );
}
