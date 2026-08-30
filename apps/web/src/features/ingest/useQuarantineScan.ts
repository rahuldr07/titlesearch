import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { QuarantineResponse, QuarantineState } from "@titlepipe/contract";
import { scanPackage } from "./uploadPackage";

/** One checklist row as DRAWN right now — the server's state, or the two
 * reveal words (`pending`/`running`) for rows the cadence has not reached. */
export interface GatewayRow {
  readonly id: string;
  readonly label: string;
  readonly state: QuarantineState;
}

/**
 * THE GATEWAY SCAN, AND ITS DRAWN CADENCE.
 *
 * ⚠ RULED 2026-08-29 (`docs/frontend/design-2026-08/RULING-2026-08-29.md`):
 * the reference runs the quarantine checklist INLINE the moment a file lands —
 * each row queued → checking… → clear on a 480ms beat (`dropFile` in
 * reference-app.html). So: the file goes to `POST /api/intake/quarantine` at
 * once, and the rows then REVEAL the server's own per-step states on the
 * reference's cadence. The stagger is presentation only — no state is decided
 * here, no step invented, and a step the server failed is revealed failed.
 */
export function useQuarantineScan() {
  /* The reveal counter is KEYED to the response object it reveals, so a new
     scan restarts at zero with no synchronous reset inside the effect — the
     derivation below reads 0 for any response the timers have not touched. */
  const [reveal, setReveal] = useState<{
    readonly of: QuarantineResponse | null;
    readonly n: number;
  }>({ of: null, n: 0 });
  const timers = useRef<readonly ReturnType<typeof setTimeout>[]>([]);
  const clear = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const mutation = useMutation({ mutationFn: scanPackage });
  const data: QuarantineResponse | null = mutation.data ?? null;
  const shown = reveal.of === data ? reveal.n : 0;

  useEffect(() => {
    if (data === null) return;
    timers.current = data.steps.map((_, i) =>
      setTimeout(() => setReveal({ of: data, n: i + 1 }), 480 * (i + 1)),
    );
    return clear;
  }, [data, clear]);

  const { mutate, reset: resetMutation } = mutation;
  const scan = useCallback((file: File) => mutate(file), [mutate]);
  const reset = useCallback(() => {
    clear();
    setReveal({ of: null, n: 0 });
    resetMutation();
  }, [resetMutation, clear]);

  const rows: readonly GatewayRow[] =
    data === null
      ? []
      : data.steps.map((step, i): GatewayRow => {
          if (i < shown) return { id: step.id, label: step.label, state: step.state };
          const state: QuarantineState = i === shown ? "running" : "pending";
          return { id: step.id, label: step.label, state };
        });

  const done = data !== null && shown >= data.steps.length;
  return {
    data,
    rows,
    done,
    /** "Quarantine Clear": every SERVER state passed, and the stamp read. */
    ready:
      done && data.steps.every((s) => s.state === "passed") && data.resolved !== null,
    scanning: mutation.isPending || (data !== null && !done),
    failure: mutation.isError ? mutation.error.message : null,
    scan,
    reset,
  };
}
