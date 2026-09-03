import { Button, SegmentedControl, Segment, Toggle } from "../../components/ui";

/**
 * Local magnification. The three step labels are the only numbers on this
 * pane that are not the server's — which is why the control is labelled as
 * a view control.
 */
export type ZoomLevel = "fit" | "half" | "double";

const STEPS: readonly { readonly id: ZoomLevel; readonly label: string }[] = [
  { id: "fit", label: "Fit" },
  { id: "half", label: "150%" },
  { id: "double", label: "200%" },
];

function isZoom(key: unknown): key is ZoomLevel {
  return key === "fit" || key === "half" || key === "double";
}

/**
 * Prev / page / next, and the magnifier. The label is `p6 / 64` — the
 * position and `total_pages`, both printed.
 */
export function PageBar(props: {
  readonly shown: number;
  readonly total: number;
  readonly zoom: ZoomLevel;
  readonly onGo: (n: number) => void;
  readonly onZoom: (z: ZoomLevel) => void;
  /**
   * "◉ Following / ○ Free" — when on, the page follows the field focused
   * on the left. A view preference and nothing else: it changes which sheet
   * is on screen, never what any field says.
   */
  readonly following: boolean;
  readonly onFollowing: (following: boolean) => void;
}) {
  const first = props.shown <= 1;
  const last = props.shown >= props.total;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-line-subtle bg-surface-panel px-6 py-4">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onPress={() => props.onGo(props.shown - 1)}
          disabledBecause={
            first ? "Page 1 is the first page in this package." : undefined
          }
        >
          Prev
        </Button>
        <span
          data-testid="scan-page-label"
          className="font-mono text-meta leading-flat font-semibold tabular-nums text-ink-primary"
        >
          p{props.shown} / {props.total}
        </span>
        <Button
          size="sm"
          onPress={() => props.onGo(props.shown + 1)}
          disabledBecause={
            last
              ? `Page ${props.total} is the last page the server counted in this package.`
              : undefined
          }
        >
          Next
        </Button>
      </div>

      <div className="flex items-center gap-4">
      <Toggle
        data-testid="follow-citation"
        aria-label="Follow the open field's citation"
        isSelected={props.following}
        onChange={props.onFollowing}
      >
        {props.following ? "◉ Following" : "○ Free"}
      </Toggle>

      <SegmentedControl
        label="Page magnification — a view control, not a measurement"
        selectedKeys={[props.zoom]}
        onSelectionChange={(keys) => {
          const picked = [...keys][0];
          if (isZoom(picked)) props.onZoom(picked);
        }}
      >
        {STEPS.map((step) => (
          <Segment key={step.id} id={step.id}>
            {step.label}
          </Segment>
        ))}
      </SegmentedControl>
      </div>
    </div>
  );
}
