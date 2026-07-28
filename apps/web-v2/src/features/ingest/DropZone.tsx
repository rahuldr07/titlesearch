import { useRef, useState } from "react";
import { cn } from "../../shared/ui/classNames";

/**
 * ONE PDF, ONE ORDER.
 *
 * The drop zone is the design's own framing and it is load-bearing copy, not
 * decoration: a reviewer who drops three county packages expecting three orders
 * gets one order with two documents nobody will ever look at. Saying "one PDF,
 * one order" at the moment of the drop is cheaper than discovering it at
 * delivery.
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
    <div className="flex flex-col gap-4">
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
          "flex flex-col items-center gap-3 rounded-6 border border-dashed p-9 text-center",
          over ? "border-action bg-action-surface" : "border-line-strong bg-surface-sunken",
        )}
      >
        <span className="font-mono text-micro tracking-badge font-bold text-ink-muted">PDF</span>
        <span className="text-base font-semibold text-ink-primary">
          Drop the search package here
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs font-semibold text-action underline"
        >
          or click to browse — one PDF, one order
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          data-testid="package-input"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </div>

      {file === null ? null : (
        <div className="flex flex-wrap items-baseline gap-5 rounded-5 border border-line-strong bg-surface-panel px-6 py-4">
          <span className="font-mono text-xs text-ink-primary">{file.name}</span>
          <span className="text-tiny text-ink-muted">
            {(file.size / 1_000_000).toFixed(1)} MB
          </span>
          {/*
            CONTRACT GAP: the design shows a page count and a readability verdict
            on the chip. Both are findings about the FILE, produced by the
            server after it opens the PDF, and neither is in any response shape.
            Counting pages in the browser would be the client asserting a fact
            about a document it has not processed.
          */}
          <span className="text-tiny text-ink-muted">
            page count and readability are the server&rsquo;s findings, after upload
          </span>
        </div>
      )}
    </div>
  );
}
