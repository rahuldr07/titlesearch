import type { ReactNode } from "react";
import type { Field, OrderCensus } from "@titlepipe/contract";
import { ScreenBoundary } from "../../app/chrome/ScreenBoundary";
import { DecisionDock } from "./DecisionDock";
import { CountersignPanel } from "./CountersignPanel";
import { FieldQueue } from "./FieldQueue";
import type { Section } from "./fieldNaming";
import type { InlineEditProps } from "./useEditAsk";

/**
 * The workstation's left column — the dock, the second read, and the queue.
 * Its own component because the screen outgrew the char budget once it also
 * owned hover-preview, inline editing and a boundary per pane; `check-rules`
 * said "a component is missing" and it was this one.
 *
 * It composes and decides nothing: every list, count and callback arrives
 * from the screen, which is where the server's answers land.
 */
export function DecisionColumn(props: {
  readonly orderId: string;
  readonly census: OrderCensus | undefined;
  readonly sections: readonly Section[];
  readonly flaggedFirst: boolean;
  readonly selectedId: string | null;
  readonly canSelect: (field: Field) => boolean;
  readonly queueProps: InlineEditProps;
  readonly onSelect: (field: Field) => void;
  readonly onPreview: (field: Field) => void;
  readonly onPreviewEnd: () => void;
  readonly onEdit: (field: Field) => void;
  readonly renderOpen: () => ReactNode;
}) {
  return (
    <ScreenBoundary resetKey={props.orderId} region="decision column">
      <DecisionDock census={props.census} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* The second read leads: it is the gate that blocks release, so it
            is read before the sections rather than found under them. */}
        <div className="p-8">
          <CountersignPanel orderId={props.orderId} />
        </div>
        <FieldQueue
          sections={props.sections}
          flaggedFirst={props.flaggedFirst}
          selectedId={props.selectedId}
          canSelect={props.canSelect}
          {...props.queueProps}
          onSelect={props.onSelect}
          onPreview={props.onPreview}
          onPreviewEnd={props.onPreviewEnd}
          onEdit={props.onEdit}
          renderOpen={props.renderOpen}
        />
      </div>
    </ScreenBoundary>
  );
}
