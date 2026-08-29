import { useRef, useState, type DragEvent } from "react";
import { Button, cx } from "../../components/ui";

/**
 * THE DROPZONE AND THE FILE ROW. It stops at the file — name, size, and nothing
 * it cannot cite. The design's Quarantine Gateway checklist would sit under
 * this, and `IngestForm` renders a `BackendGap` in its place instead: there is
 * no quarantine-step shape in the contract, and a four-step state machine
 * written in the browser is what hard rule 3 forbids.
 *
 * The size is printed in BYTES rather than converted to MB — a converted figure
 * is arithmetic on a value the screen is showing.
 *
 * The input is `sr-only`, not `display:none`: a hidden input is not focusable
 * and a keyboard user could not reach the dropzone at all. The visible surface
 * is a `<label>`, which is what makes Enter/Space open the picker with no key
 * handler of our own.
 */
export function Dropzone(props: {
  readonly file: File | null;
  readonly onFile: (file: File | null) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  /*
   * An `<input type="file">` keeps its `value` after a change, so clearing only
   * React's state leaves the element still holding the file: re-choosing the
   * SAME package fires no `change` event and the row stays empty with no way
   * back. Clearing the element is what makes "remove, then change your mind"
   * reach the same file a second time.
   */
  function remove() {
    if (input.current !== null) input.current.value = "";
    props.onFile(null);
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    const dropped = event.dataTransfer.files.item(0);
    if (dropped !== null) props.onFile(dropped);
  }

  return (
    <div className="flex flex-col gap-6">
      <label
        data-testid="dropzone"
        data-over={over ? "true" : undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cx(
          "tp-state flex cursor-pointer flex-col items-center gap-3 rounded-md",
          "border border-dashed px-8 py-12 text-center",
          over
            ? "border-action-border bg-action-surface"
            : "border-line-strong bg-control-fill hover:border-action-border hover:bg-action-surface",
        )}
      >
        <span className="font-sans text-meta font-semibold leading-close text-ink-primary">
          Drop the county package here, or choose a file
        </span>
        <span className="font-sans text-label leading-close text-ink-muted">
          A scanned PDF. It cannot come alone — the order beside it carries what
          the PDF cannot say.
        </span>
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          data-testid="package-input"
          onChange={(event) => props.onFile(event.target.files?.item(0) ?? null)}
          className="sr-only"
        />
      </label>

      {props.file === null ? (
        <p
          data-testid="file-row-empty"
          className="font-sans text-meta leading-close text-ink-faint"
        >
          No file chosen.
        </p>
      ) : (
        <div
          data-testid="file-row"
          className="flex items-center gap-6 rounded-md border border-line-strong bg-surface-panel px-6 py-5"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-meta leading-close text-ink-primary">
            {props.file.name}
          </span>
          <span className="shrink-0 font-mono text-label leading-flat tabular-nums text-ink-muted">
            {props.file.size} bytes
          </span>
          <Button
            data-testid="remove-file"
            size="sm"
            onPress={remove}
            aria-label={`Remove ${props.file.name}`}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
