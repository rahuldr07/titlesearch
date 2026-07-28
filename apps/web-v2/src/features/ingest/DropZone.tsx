import { useRef, useState } from "react";
import { cn } from "../../shared/ui/classNames";
import { PackageChip } from "./PackageChip";

/**
 * ONE PDF, ONE ORDER.
 *
 * The drop zone is the design's own framing and it is load-bearing copy, not
 * decoration: a reviewer who drops three county packages expecting three orders
 * gets one order with two documents nobody will ever look at. Saying "one PDF,
 * one order" at the moment of the drop is cheaper than discovering it at
 * delivery.
 *
 * THE ZONE IS PAPER, NOT BACKDROP. The design draws it as a white panel carrying
 * a dashed rule, standing on the grey ground: the dash says "nothing here yet",
 * the white says "this is the sheet you are filling". Sinking it to
 * `surface-sunken` reads as a well cut into the page and loses the second half.
 *
 * THE FILE INPUT IS REAL AND KEYBOARD-REACHABLE. Drag-and-drop is an addition
 * to it, never a replacement — a drop-only target is unusable by keyboard and
 * invisible to a test harness, and `ingest.spec` sets the file directly on the
 * input.
 */
export function DropZone({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-7">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          onFile(event.dataTransfer.files[0] ?? null);
        }}
        className={cn(
          "flex flex-col items-center gap-7 rounded-9 border border-dashed p-14 text-center",
          over ? "border-action bg-action-surface" : "border-line-strong bg-surface-panel",
        )}
      >
        <span className="flex size-22 items-center justify-center rounded-7 border border-action-border font-mono text-micro tracking-badge font-bold text-action">
          PDF
        </span>
        <span className="flex flex-col gap-2">
          <span className="text-md font-semibold text-ink-primary">
            Drop the search package here
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-ink-muted hover:text-action"
          >
            or click to browse — one PDF, one order
          </button>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          data-testid="package-input"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </div>

      {file === null ? null : <PackageChip file={file} />}
    </div>
  );
}
