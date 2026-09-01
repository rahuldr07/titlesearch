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
import { usePageAsk } from "./usePageAsk";
import { DecisionDock } from "./DecisionDock";
import { sectionsOf, fieldLabel } from "./fieldNaming";
import { isQueued, resolveSelection, stepSelection } from "./queue";
import { useQueueKeys } from "./useReviewKeys";

/**
 * The Examination Workstation at `/orders/{id}/review` — the reviewer's
 * screen. Two panes on a drag divider: `Split` also carries the keyboard
 * alternative to dragging, which a hand-rolled divider would not.
 */
export function WorkstationScreen(props: {
  readonly orderId: string;
  /** `?field=` off the route, matching `orderSearch.ts`'s optional key. */
  readonly fieldPath: string | undefined;
  /** `?page=` off the route — "open the workstation at this page". Treated
      below as an outright page ask. */
  readonly page: number | undefined;
  readonly onSelectField: (path: string) => void;
}) {
  const fields = useRead(orderFields(props.orderId));
  const context = useRead(orderContext(props.orderId));
  /* A view order, not a re-ranking. It reads the `flagged` boolean the
     section already carries from the server's own queue membership —
     nothing here counts, scores or re-derives what is flagged. On by
     default; the toggle is for turning it off. */
  const [flaggedFirst, setFlaggedFirst] = useState(true);
  /* The outstanding page ask — the excerpt's "View on page" door AND the
     URL's `?page=` deep link, one state. See `usePageAsk.ts` for why the URL
     key wins over "following" exactly once. */
  const { ask, setAsk } = usePageAsk(props.page);

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
                census={data.census}
                openLabel={open === null ? null : fieldLabel(open.path)}
                flaggedFirst={flaggedFirst}
                onFlaggedFirst={setFlaggedFirst}
              />
              <Split className="min-h-0 flex-1">
                {/* 60, not an even split — the decision column leads. */}
                <SplitPanel
                  defaultSize="60"
                  minSize={DECISION_MIN}
                  maxSize={DECISION_MAX}
                  className="border-r border-line-strong bg-surface-panel"
                >
                  <DecisionDock census={data.census} />
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {/* The second read leads: it is the gate that blocks
                        release, so it is read before the sections rather
                        than found under them. */}
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
                        <DecisionPanel
                          field={open}
                          orderId={props.orderId}
                          onViewPage={(page) => setAsk({ page })}
                        />
                      )}
                    />
                  </div>
                </SplitPanel>

                <SplitHandle label="Resize the decision column against the source page" />

                <SplitPanel className="bg-surface-app">
                  {/*
                   * The citation renders as a pin on the source page and as
                   * a box over the region it was read from. `line` stays
                   * null: a coordinate is a position, not an ordinal, and
                   * guessing an index off `y` would be the browser deciding
                   * which line the engine meant.
                   */}
                  <ScanPane
                    orderId={props.orderId}
                    page={open?.source_page ?? null}
                    line={null}
                    box={open?.source_line_coords ?? null}
                    request={ask}
                  />
                </SplitPanel>
              </Split>
              <WorkstationFooter orderId={props.orderId} census={data.census} />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
