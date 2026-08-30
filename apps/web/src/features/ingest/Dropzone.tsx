import { useRef, useState, type DragEvent } from "react";
import { Badge, cx, type BadgeProps } from "../../components/ui";

/**
 * THE DROPZONE AND THE FILE ROW, AS DRAWN.
 *
 * ⚠ RULED 2026-08-29 (`docs/frontend/design-2026-08/RULING-2026-08-29.md`):
 * the reference's copy is built verbatim — the icon disc, "Drop scanned title
 * package here", and the "single PDF bundle (20–150 pages) · 300 DPI
 * recommended" sub-line the previous build refused for want of a citable
 * source. The file row prints the size in MB as the reference draws it, and
 * carries the quarantine pill the parent computes from the SERVER's scan.
 *
 * The input is `sr-only`, not `display:none`: a hidden input is not focusable
 * and a keyboard user could not reach the dropzone at all. The visible surface
 * is a `<label>`, which is what makes Enter/Space open the picker with no key
 * handler of our own.
 */
export function Dropzone(props: {
  readonly file: File | null;
  /** The quarantine pill — "Scanning…" / "Quarantine Clear" — parent-computed
   * from the server's scan states, never decided here. */
  readonly pill: { readonly text: string; readonly tone: BadgeProps["tone"] };
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

  if (props.file !== null) {
    return (
      <div
        data-testid="file-row"
        className="flex items-center gap-7 rounded-lg border border-line-strong bg-control-fill p-7"
      >
        <span className="flex h-22 w-18 shrink-0 items-center justify-center rounded-md border border-action-border bg-action-surface font-mono text-label font-bold leading-flat text-ink-secondary">
          PDF
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-mono text-meta font-bold leading-close text-ink-primary">
            {props.file.name}
          </span>
          {/* MB as the reference draws it (RULING-2026-08-29) — one decimal,
              converted from the browser's own File.size. */}
          <span className="font-sans text-label leading-flat text-ink-muted">
            {(props.file.size / 1_000_000).toFixed(1)} MB
          </span>
        </span>
        <span data-testid="quarantine-pill" className="shrink-0">
          <Badge tone={props.pill.tone}>{props.pill.text}</Badge>
        </span>
        <button
          type="button"
          data-testid="remove-file"
          onClick={remove}
          aria-label={`Remove ${props.file.name}`}
          className="tp-state tp-ring flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-pill border-none bg-surface-sunken font-sans text-label font-bold text-ink-muted"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
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
        "tp-state flex cursor-pointer flex-col items-center gap-3 rounded-lg",
        "border-2 border-dashed px-16 py-20 text-center",
        over
          ? "border-action-border bg-action-surface"
          : "border-line-strong bg-control-fill hover:border-action-border hover:bg-action-surface",
      )}
    >
      <span
        aria-hidden
        className="mb-3 flex size-20 items-center justify-center rounded-lg bg-action-surface font-sans text-subject font-bold text-ink-secondary"
      >
        ⤓
      </span>
      <span className="font-sans text-body font-bold leading-close text-ink-primary">
        Drop scanned title package here
      </span>
      <span className="font-sans text-meta leading-close text-ink-muted">
        or click to browse · single PDF bundle (20–150 pages) · 300 DPI
        recommended
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
  );
}
