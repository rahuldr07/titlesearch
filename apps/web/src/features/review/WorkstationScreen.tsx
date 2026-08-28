import { useState } from "react";
import { useRead } from "../../app/useRead";
import { orderContext, orderFields } from "../../shared/queries";
import { QueryState } from "../../entities/state/QueryState";
import {
  DECISION_MAX,
  DECISION_MIN,
  Split,
  SplitHandle,
  SplitPanel,
} from "../../components/ui";
import { WorkstationBar } from "./WorkstationBar";
import { FieldQueue } from "./FieldQueue";
import { DecisionPanel } from "./DecisionPanel";
import { CountersignPanel } from "./CountersignPanel";
import { WorkstationFooter } from "./WorkstationFooter";
import { ScanPane } from "./ScanPane";
import { DecisionDock } from "./DecisionDock";
import { OrderRail } from "./OrderRail";
import { sectionsOf, fieldLabel } from "./fieldNaming";
import { isQueued, resolveSelection, stepSelection } from "./queue";
import { useQueueKeys } from "./useReviewKeys";

/**
 * THE EXAMINATION WORKSTATION at `/orders/{id}/review` — the reviewer's screen,
 * and the one PRODUCT.md says wins when roles conflict.
 *
 * TWO PANES ON A DRAG DIVIDER. `components/ui/resizable.tsx` was written for
 * this screen ("THE §7 EXAMINATION WORKSTATION SPLIT", 38–74% band in
 * `splitBand.ts`) and had no consumer; the panes were two fixed `flex-1`
 * columns, so the design's divider did not exist. `Split` also carries the
 * WCAG 2.5.7 keyboard alternative, which a hand-rolled divider would not.
 */
export function WorkstationScreen(props: {
  readonly orderId: string;
  /** `?field=` off the route, matching `orderSearch.ts`'s optional key. */
  readonly fieldPath: string | undefined;
  readonly onSelectField: (path: string) => void;
}) {
  const fields = useRead(orderFields(props.orderId));
  const context = useRead(orderContext(props.orderId));
  /* A VIEW ORDER, not a re-ranking. It reads the `flagged` boolean the section
     already carries from the server's own queue membership — nothing here
     counts, scores or re-derives what is flagged. */
  const [flaggedFirst, setFlaggedFirst] = useState(false);

  const all = fields.data?.fields ?? [];
  const step = (direction: 1 | -1) => {
    const next = stepSelection(all, resolveSelection(all, props.fieldPath), direction);
    if (next !== null) props.onSelectField(next.path);
  };

  useQueueKeys({
    enabled: all.length > 0,
    onNext: () => step(1),
    onPrevious: () => step(-1),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <QueryState query={fields} of="this order's fields">
        {(data) => {
          const open = resolveSelection(data.fields, props.fieldPath);
          const sections = sectionsOf(data.fields, isQueued);
          return (
            <>
              <WorkstationBar
                orderRef={context.data?.order_ref ?? null}
                openLabel={open === null ? null : fieldLabel(open.path)}
                flaggedFirst={flaggedFirst}
                onFlaggedFirst={setFlaggedFirst}
              />
              <Split className="min-h-0 flex-1">
                <SplitPanel
                  defaultSize="50"
                  minSize={DECISION_MIN}
                  maxSize={DECISION_MAX}
                  className="border-r border-line-strong bg-surface-panel"
                >
                  <OrderRail orderId={props.orderId} />
                  <DecisionDock census={data.census} />
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {/* THE SECOND READ LEADS, as the design draws it: it is the
                        gate that blocks release, so it is read before the
                        sections rather than found under them. */}
                    <div className="p-8">
                      <CountersignPanel orderId={props.orderId} />
                    </div>
                    <FieldQueue
                      sections={sections}
                      flaggedFirst={flaggedFirst}
                      selectedId={open?.id ?? null}
                      canSelect={isQueued}
                      onSelect={(field) => props.onSelectField(field.path)}
                      renderOpen={() => (
                        <DecisionPanel field={open} orderId={props.orderId} />
                      )}
                    />
                  </div>
                </SplitPanel>

                <SplitHandle label="Resize the decision column against the source page" />

                <SplitPanel className="bg-surface-app">
                  {/*
                   * INVARIANT 33: the citation renders as a pin on the source
                   * page. `source_line_coords` is `z.unknown()` until the
                   * LLMWhisperer adapter lands (entities.ts:29), so the pin
                   * marks the PAGE and says no line coordinate was recorded
                   * rather than guessing an index.
                   */}
                  <ScanPane
                    orderId={props.orderId}
                    page={open?.source_page ?? null}
                    line={null}
                  />
                </SplitPanel>
              </Split>
              <WorkstationFooter census={data.census} />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
