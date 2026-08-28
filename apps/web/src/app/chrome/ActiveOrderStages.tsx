import { useQuery } from "@tanstack/react-query";
import { orderPipeline } from "../../shared/queries";
import { get } from "../../shared/api";
import { StatusMark } from "../../components/ui";

/**
 * THE ACTIVE ORDER'S STAGES, NUMBERED, IN THE RAIL.
 *
 * Design §App shell: "Active Order (numbered stages 1–5 with state dots)". The
 * rail previously drew ONE row here — the Review door — because the door table
 * has one entry for the order world. The design draws the order's PROGRESS
 * through the pipeline beside it, which is a different thing from a door: a
 * door is somewhere you may go, a stage is where the work has got to.
 *
 * EVERY VALUE IS THE SERVER'S. `OrderPipelineResponse` (intake.ts:91) carries
 * `stages: PipelineStage[]`, each with a `label` and a `phase` from a closed
 * four-member enum — done / running / halted / waiting. Nothing here derives a
 * phase, counts a stage, or infers a halt from the shape of the list;
 * `gate_halted` is its own server field for exactly that reason (intake.ts:97:
 * "Server state. The screen never infers a halt from a stage list.").
 *
 * The NUMBER is positional and that is the one thing composed here — it is the
 * stage's place in the server's own ordering, not a judgement about it. A
 * completed stage shows a ✓ instead, per rule 7's glyph vocabulary.
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
    <ol className="flex flex-col gap-1 py-1">
      {pipeline.data.stages.map((stage, index) => (
        <li
          key={stage.id}
          data-slot="rail-stage"
          data-phase={stage.phase}
          className="flex items-center gap-6 px-10 py-3"
        >
          <span
            aria-hidden
            className="w-8 shrink-0 text-center font-mono text-label leading-flat"
          >
            {stage.phase === "done" ? (
              <StatusMark mark="settled" label="" />
            ) : stage.phase === "halted" ? (
              <StatusMark mark="halt" label="" />
            ) : (
              index + 1
            )}
          </span>
          <span className="truncate font-sans text-meta leading-close text-rail-ink">
            {stage.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
