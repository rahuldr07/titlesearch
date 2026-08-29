import { useQuery } from "@tanstack/react-query";
import { orderPipeline } from "../../shared/queries";
import { get } from "../../shared/api";
import { StageMark } from "./StageMark";

/**
 * The active order's stages, under the Active Order rubric — the design's
 * numbered rows with their ✓/numeral circle.
 *
 * THE LIST IS THE SERVER'S, WHOLE. The design draws five; this order's pipeline
 * has nine, and truncating it to five would be the browser deciding which
 * stages count. Every mark comes from `stage.phase`; nothing here infers "done"
 * from a count reaching a total (`entities/order/StageDots.tsx` carries the
 * long form of that refusal).
 *
 * NO COUNT BADGE. The design hangs an amber `6` on Examination; INVARIANT 66
 * says attention rides a door as a dot and never as a workload figure, and the
 * row's own circle already states the phase.
 */
export function ActiveOrderStages(props: { readonly orderId: string }) {
  const descriptor = orderPipeline(props.orderId);
  const pipeline = useQuery({
    queryKey: descriptor.key,
    queryFn: () => get(descriptor.path, descriptor.schema),
  });

  /*
   * Silence rather than a spinner. The rail is chrome: it is on screen before
   * any order is, and a row of skeletons in it reads as five stages that exist
   * and have not loaded. Nothing is a truer statement than that.
   */
  if (pipeline.data === undefined) return null;

  return (
    <ol className="flex flex-col gap-1 pt-1">
      {pipeline.data.stages.map((stage, index) => (
        <li
          key={stage.id}
          data-slot="rail-stage"
          data-phase={stage.phase}
          /* Not a `Link`: a stage is where the work has got to, and no route
             in this app addresses one. The doors above it are the links. */
          className="flex h-17 items-center gap-5 rounded-lg px-6"
        >
          <StageMark phase={stage.phase} ordinal={index + 1} ground="rail" />
          <span className="min-w-0 flex-1 truncate font-sans text-meta leading-flat text-rail-ink">
            {stage.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
