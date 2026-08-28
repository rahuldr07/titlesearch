import { useRef, useState, type DragEvent } from "react";
import { Button, cx } from "../../components/ui";

/**
 * THE DROPZONE AND THE FILE ROW (design §Screens 5: "dropzone (dashed, hover
 * accent) → file row").
 *
 * ══ WHAT SITS BETWEEN THE FILE ROW AND THE SHA LINE IS NOT BUILT ═══════════
 *
 * The design puts the Quarantine Gateway checklist here — AV → real-PDF →
 * SHA-256, sequential, with a pulsing dot and per-step "queued / checking… /
 * clear". There is no shape for it anywhere in the contract, and inventing a
 * four-step state machine in the browser is precisely what hard rule 3
 * forbids. `IngestScreen` renders a `BackendGap` in its place. This component
 * therefore stops at the file: name, size, and nothing it cannot cite.
 *
 * The size is printed in BYTES rather than converted to MB. A converted figure
 * is arithmetic on a value the screen is showing, and the honest number is the
 * one the browser has.
 *
 * ══ THE INPUT IS REAL AND IS NOT HIDDEN FROM ASSISTIVE TECH ════════════════
 *
 * `sr-only` rather than `display:none` — a hidden input is not focusable and a
 * keyboard user cannot reach the dropzone at all. The visible surface is a
 * `<label>`, which is what makes Enter/Space open the picker with no key
 * handler of our own.
 */
export function Dropzone(props: {
  readonly file: File | null;
  readonly onFile: (file: File | null) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  /*
   * THE FILE ROW'S ✕, and the line that makes it work twice.
   *
   * An `<input type="file">` keeps its `value` after a change, so clearing only
   * React's state leaves the element still holding the file: re-choosing the
   * SAME package fires no `change` event and the row stays empty with no way
   * back. Clearing the element is what makes "remove, look again, change your
   * mind" reach the same file a second time.
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
