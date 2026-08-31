import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { OrderContextResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { cx } from "../../components/ui";
import { StageLink, stageIsCurrent } from "./StageLink";
import { StageBadge, StageCircle } from "./StageMark";

/**
 * The active order's stages, under the Active Order rubric. The list is
 * `OrderContextResponse.stage_nav`, served whole: `done` and every badge
 * string arrive decided, and nothing here infers a check from a count
 * reaching a total.
 */
export function ActiveOrderStages(props: { readonly orderId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const context = useQuery({
    queryKey: ["orders", props.orderId, "context"],
    queryFn: () => get(`/api/orders/${props.orderId}/context`, OrderContextResponse),
  });

  /*
   * Silence rather than a spinner. The rail is chrome: it is on screen before
   * any order is, and a row of skeletons in it reads as five stages that exist
   * and have not loaded. Nothing is a truer statement than that.
   */
  if (context.data === undefined) return null;

  return (
    <ol className="flex flex-col gap-1 pt-1">
      {context.data.stage_nav.map((stage, index) => {
        const current = stageIsCurrent(stage.id, pathname);
        return (
          <li key={stage.id} data-slot="rail-stage" data-done={stage.done}>
            <StageLink
              id={stage.id}
              orderId={props.orderId}
              testId={`rail-stage-${stage.id}`}
              className={cx(
                "tp-state flex h-17 items-center gap-5 rounded-lg px-6",
                current && "bg-rail-fill",
              )}
            >
              <StageCircle
                done={stage.done}
                current={current}
                ordinal={index + 1}
                ground="rail"
              />
              <span
                className={cx(
                  "min-w-0 flex-1 truncate font-sans text-meta leading-flat",
                  current ? "font-semibold text-surface-panel" : "text-rail-ink",
                )}
              >
                {stage.label}
              </span>
              {stage.badge !== null && (
                <StageBadge tone={stage.badge_tone}>{stage.badge}</StageBadge>
              )}
            </StageLink>
          </li>
        );
      })}
    </ol>
  );
}
