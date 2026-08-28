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
 * THE EXAMINATION WORKSTATION at `/orders/{id}/review` — the reviewer's screen,
 * and the one PRODUCT.md says wins when roles conflict.
 *
 * ══ ITS PARTS ALREADY EXISTED AND NOTHING ASSEMBLED THEM ═══════════════════
 *
 * `features/review/` held eleven files with ZERO consumers outside itself:
 * `FieldRow`, `DecisionDock`, `RowValue`, `RowMark`, `T1Pill`, `HotkeyChips`,
 * `fieldNaming`, `panelRubric`, `queue.ts`, `readings.ts` and
 * `useReviewWrites`. All of it good — `useReviewWrites` carries the synchronous
 * in-flight latch INVARIANT 20/21 needs, surfaces the server's sentence
 * verbatim (14), and reaches `after` only on success so selection never
 * advances on a refusal (16). `endpoints.ts:167-190` even added
 * `decisions`/`settled`/`queue_rest` to `OrderCensus` FOR THIS DOCK. The
 * machinery and the wire were both built; the screen was not.
 *
 * ══ THE THREE PANES, MEASURED OFF `reference-app.html` ═════════════════════
 *
 *     top bar   white, 1px underneath          → WorkstationBar
 *     200px     section rail                   → SectionRail
 *     flex:1    field list + open decision      → FieldQueue + DecisionPanel
 *     flex:1    the source page on #F3F4F7      → features/scan/ScanPane
 *
 * INVARIANT 60/61: the frame is one screen and only the panes scroll. Each
 * column owns its own overflow; the bar and the dock stay put.
 *
 * ══ SELECTION IS URL-OWNED ═════════════════════════════════════════════════
 *
 * INVARIANT 55: "`?field=` lands on the exact field in context." `resolveSelection`
 * (`queue.ts:56`) turns the search key into a field or null, and INVARIANT 27's
 * rule lives there too — the cursor visits only server-queued fields, so a
 * `?field=` naming an auto-confirmed one does not select it.
 *
 * ══ WHAT IS REFUSED ════════════════════════════════════════════════════════
 *
 * The T1 second read (`CountersignGap`) and the prototype's footer button
 * "Advance to Publication Studio →". Release compile has no endpoint, no gate
 * shape and no `release.execute` action, so the button would call nothing; the
 * gap states it once rather than twice.
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
