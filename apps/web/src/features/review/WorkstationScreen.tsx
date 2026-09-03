import { useState } from "react";
import { useRead } from "../../app/useRead";
import { ScreenBoundary } from "../../app/chrome/ScreenBoundary";
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
import { DecisionColumn } from "./DecisionColumn";
import { DecisionPanel } from "./DecisionPanel";
import { WorkstationFooter } from "./WorkstationFooter";
import { ScanPane } from "./ScanPane";
import { usePageAsk } from "./usePageAsk";
import { sectionsOf, fieldLabel } from "./fieldNaming";
import { isQueued, resolveSelection, stepSelection } from "./queue";
import { useQueueKeys } from "./useReviewKeys";
import { useEditAsk } from "./useEditAsk";

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
  /*
   * The hovered row, TAGGED WITH THE SELECTION IT WAS MADE UNDER.
   *
   * The preview used to be a bare id that nothing ever cleared, so the last
   * row the pointer crossed kept the source sheet for the rest of the
   * session and outranked the open field: the examiner read a decision
   * against another field's page while the pin under it claimed the
   * selected field cited it. `onPreviewEnd` handles the pointer leaving,
   * but not J/K or the auto-advance after a confirm — there the selection
   * moves under a pointer that never moved.
   *
   * Carrying `at` makes that staleness a derivation rather than an effect:
   * a hover belongs to the selection it happened under, and the moment the
   * selection changes it is simply no longer this one. Clearing it in an
   * effect instead would be a second render pass, and the sheet would paint
   * the wrong page for one frame.
   */
  const [hover, setHover] = useState<{
    readonly id: string;
    readonly at: string | undefined;
  } | null>(null);
  const hovered = hover !== null && hover.at === props.fieldPath ? hover.id : null;

  const edit = useEditAsk(props.orderId);
  const previewRow = (field: { readonly id: string }) => {
    setHover({ id: field.id, at: props.fieldPath });
  };
  const clearPreview = () => {
    setHover(null);
  };
  const beginEdit = (field: { readonly path: string }) => {
    props.onSelectField(field.path);
    edit.raise(field.path);
  };

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
          const preview = data.fields.find((f) => f.id === hovered) ?? open;
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
                  className="bg-surface-panel"
                >
                  <DecisionColumn
                    orderId={props.orderId}
                    census={data.census}
                    sections={sections}
                    flaggedFirst={flaggedFirst}
                    selectedId={open?.id ?? null}
                    canSelect={isQueued}
                    queueProps={edit.queueProps}
                    onSelect={(field) => {
                      props.onSelectField(field.path);
                      edit.clicked(field.path);
                    }}
                    onPreview={previewRow}
                    onPreviewEnd={clearPreview}
                    onEdit={beginEdit}
                    renderOpen={() => (
                      <DecisionPanel
                        field={open}
                        orderId={props.orderId}
                        onViewPage={(page) => setAsk({ page })}
                      />
                    )}
                  />
                </SplitPanel>

                <SplitHandle label="Resize the decision column against the source page" />

                <SplitPanel className="bg-surface-viewer">
                  {/*
                   * The citation renders as a pin on the source page and as
                   * a box over the region it was read from. `line` stays
                   * null: a coordinate is a position, not an ordinal, and
                   * guessing an index off `y` would be the browser deciding
                   * which line the engine meant.
                   */}
                  <ScreenBoundary
                    resetKey={`${props.orderId}:${String(open?.source_page ?? "")}`}
                    region="source page"
                  >
                    <ScanPane
                      orderId={props.orderId}
                      page={preview?.source_page ?? null}
                      line={null}
                      box={preview?.source_line_coords ?? null}
                      request={ask}
                      /* The pin asserts provenance, so it has to know whose.
                         While a hovered row is being previewed the page on
                         screen is NOT the open field's citation, and saying
                         it is was a citation the screen could not make. */
                      previewing={preview !== null && preview.id !== open?.id}
                    />
                  </ScreenBoundary>
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
