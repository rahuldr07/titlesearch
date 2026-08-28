import { Button, SegmentedControl, Segment } from "../../components/ui";

/**
 * Local magnification. Three steps, exactly the reference's ("Fit", "150%",
 * "200%"), and the labels are the only numbers on this pane that are not the
 * server's — which is precisely why they are labelled as a VIEW control. A
 * percentage that came from the pipeline (coverage, confidence, agreement)
 * would be a measurement; this one is how big the paper is on your monitor,
 * and it changes nothing about the record.
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
 * PREV / PAGE / NEXT, and the magnifier.
 *
 * The label is `p6 / 64` — the position and `total_pages`, both printed. Mono,
 * because rule 3 reserves it for data and a page coordinate is the canonical
 * case. Rule 9 pays for the bounds: a Prev that cannot go anywhere says why,
 * rather than dimming and leaving the reader to guess whether the package ends
 * here or the control is broken.
 */
export function PageBar(props: {
  readonly shown: number;
  readonly total: number;
  readonly zoom: ZoomLevel;
  readonly onGo: (n: number) => void;
  readonly onZoom: (z: ZoomLevel) => void;
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
  );
}
