import { useQuery } from "@tanstack/react-query";
import { orderPipeline } from "../../shared/queries";
import { get } from "../../shared/api";
import { StatusMark } from "../../components/ui";

/**

 * The active order's stages, numbered, in the rail. Design §App shell: "Active Order

 * (numbered stages 1–5 with state dots)".

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
