import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { OrderPipelineResponse } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { post } from "../../shared/api";
import { orderPipeline } from "../../shared/queries";

/**
 * THE EXTRACTION SCREEN'S HEADER ROW, as the reference draws it — ⚠ RULED
 * 2026-08-29 (`docs/frontend/design-2026-08/RULING-2026-08-29.md`): eyebrow
 * pill with the pulse dot, the title, and on the right the "Time to
 * examination" caption over the "↺ Replay" control and the ETA chip.
 *
 * `eta_label` is the SERVER'S string (intake.ts, same ruling) — the chip
 * prints it verbatim and subtracts no timestamps. Replay POSTs the ruling's
 * `/pipeline/replay` endpoint and writes the RESPONSE into the pipeline's one
 * cache entry, so the timeline repaints from what the server re-served —
 * never from anything composed here.
 */
export function ExtractionHeader(props: {
  readonly orderId: string;
  readonly etaLabel: string;
}) {
  const client = useQueryClient();
  const [replayNote, setReplayNote] = useState<string | null>(null);
  /* The synchronous latch, same shape as `useCountersign`: state is read at
     render time, so two clicks in one tick would file two replays. */
  const inFlight = useRef(false);

  const replay = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setReplayNote(null);
    const read = orderPipeline(props.orderId);
    post(`/api/orders/${props.orderId}/pipeline/replay`, OrderPipelineResponse)
      .then((served) => client.setQueryData(read.key, served))
      .catch((error: Error) => setReplayNote(error.message))
      .finally(() => {
        inFlight.current = false;
      });
  };

  return (
    <div className="flex flex-wrap items-end justify-between gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <span className="flex w-fit items-center gap-4 rounded-pill border border-action-border-strong bg-action-surface px-5 py-2 text-label font-semibold leading-flat text-ink-secondary">
          <span
            aria-hidden
            className="size-3 animate-tp-pulse rounded-pill bg-state-settled"
          />
          Autonomous Dual-Engine Pipeline
        </span>
        <h2 className="font-sans text-title font-bold leading-flat tracking-tight text-ink-primary">
          Extraction &amp; Provenance Telemetry
        </h2>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-label font-bold leading-flat text-ink-muted">
          Time to examination
        </span>
        <div className="flex items-center gap-4">
          <Button
            data-testid="pipeline-replay"
            variant="secondary"
            onPress={replay}
            aria-label="Replay the extraction run"
          >
            ↺ Replay
          </Button>
          <span
            data-testid="pipeline-eta"
            className="flex items-center rounded-lg border border-line-strong bg-surface-panel px-8 py-4 font-mono text-body font-bold leading-flat text-ink-primary"
          >
            {props.etaLabel}
          </span>
        </div>
        {replayNote !== null && (
          <p className="text-label leading-body text-state-halt">{replayNote}</p>
        )}
      </div>
    </div>
  );
}
