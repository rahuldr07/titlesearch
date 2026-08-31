import { useRouterState } from "@tanstack/react-router";
import type { OrderStageTab } from "@titlepipe/contract";
import { cx } from "../../components/ui";
import { StageLink, stageIsCurrent } from "./StageLink";
import { StageBadge, StageCircle } from "./StageMark";

/**
 * The strip's second row — the five stage tabs. The list is
 * `OrderContextResponse.stage_tabs`, served whole: `done` and every badge
 * string arrive decided; the only thing computed here is which tab the
 * current URL shows, which is the router's fact, not the server's.
 */
export function OrderStripStages(props: {
  readonly orderId: string;
  readonly tabs: readonly OrderStageTab[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <ol
      data-testid="order-strip-stages"
      className="flex flex-wrap items-center gap-2 border-t border-line-faint pt-4"
    >
      {props.tabs.map((tab, index) => {
        const current = stageIsCurrent(tab.id, pathname);
        return (
          <li key={tab.id} data-slot="strip-stage" data-done={tab.done}>
            <StageLink
              id={tab.id}
              orderId={props.orderId}
              testId={`strip-stage-${tab.id}`}
              className={cx(
                "tp-state flex shrink-0 items-center gap-4 rounded-lg px-6 py-2",
                "text-meta leading-flat whitespace-nowrap",
                current
                  ? "bg-action-surface font-bold text-ink-secondary"
                  : "font-medium text-ink-muted",
              )}
            >
              <StageCircle
                done={tab.done}
                current={current}
                ordinal={index + 1}
                ground="strip"
              />
              {tab.label}
              {tab.badge !== null && (
                <StageBadge tone={tab.badge_tone}>{tab.badge}</StageBadge>
              )}
            </StageLink>
          </li>
        );
      })}
    </ol>
  );
}
