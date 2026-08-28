import { useRead } from "../../app/useRead";
import { orderContext, orderFields } from "../../shared/queries";
import { QueryState } from "../../entities/state/QueryState";
import { WorkstationBar } from "./WorkstationBar";
import { FieldQueue } from "./FieldQueue";
import { DecisionPanel } from "./DecisionPanel";
import { CountersignGap } from "./CountersignGap";
import { WorkstationFooter } from "./WorkstationFooter";
import { ScanPane } from "./ScanPane";
import { DecisionDock } from "./DecisionDock";
import { sectionsOf, fieldLabel } from "./fieldNaming";
import { isQueued, resolveSelection } from "./queue";

/**

 * THE EXAMINATION WORKSTATION at `/orders/{id}/review` — the reviewer's screen, and

 * the one PRODUCT.md says wins when roles conflict. `features/review/` held eleven

 * files with ZERO consumers outside itself: `FieldRow`, `DecisionDock`,…

 */
export function WorkstationScreen(props: {
  readonly orderId: string;
  /** `?field=` off the route, matching `orderSearch.ts`'s optional key. */
  readonly fieldPath: string | undefined;
  readonly onSelectField: (path: string) => void;
}) {
  const fields = useRead(orderFields(props.orderId));
  const context = useRead(orderContext(props.orderId));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <QueryState query={fields} of="this order's fields">
        {(data) => {
          const selected = resolveSelection(data.fields, props.fieldPath);
          const sections = sectionsOf(data.fields, isQueued);
          return (
            <>
              <WorkstationBar
                orderRef={context.data?.order_ref ?? null}
                census={data.census}
                openLabel={selected === null ? null : fieldLabel(selected.path)}
              />
              <div className="flex min-h-0 flex-1">
                {/*
                 * TWO PANES, which is what `reference-app.html` draws. The
                 * field list and the scan, and nothing between them — the 200px
                 * section rail an earlier pass added here was read off a
                 * `min-width:200px` that belongs to the top bar's meter.
                 */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-line-strong bg-surface-panel">
                  <DecisionDock census={data.census} />
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <FieldQueue
                      sections={sections}
                      selectedId={selected?.id ?? null}
                      canSelect={isQueued}
                      onSelect={(field) => props.onSelectField(field.path)}
                      renderOpen={() => (
                        <DecisionPanel field={selected} orderId={props.orderId} />
                      )}
                    />
                    <div className="p-8">
                      <CountersignGap />
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-app">
                  {/*
                   * INVARIANT 33: the citation renders as a pin on the source
                   * page. `source_line_coords` is `z.unknown()` until the
                   * LLMWhisperer adapter lands (entities.ts:29), so the pin
                   * marks the PAGE and says no line coordinate was recorded
                   * rather than guessing an index.
                   */}
                  <ScanPane
                    orderId={props.orderId}
                    page={selected?.source_page ?? null}
                    line={null}
                  />
                </div>
              </div>
              <WorkstationFooter census={data.census} />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
