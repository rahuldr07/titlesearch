import type { CompletenessGap } from "@titlepipe/contract";
import { Empty } from "../../components/ui";
import { HubSectionLabel } from "./HubSectionLabel";
import { GapRow } from "./GapRow";

/**
 * The deterministic band — ⚠ RULED 2026-08-29
 * (`docs/frontend/design-2026-08/RULING-2026-08-29.md`): titled as the
 * reference titles it, "Deterministic Verification Checks", and drawing the
 * reference's VERIFIED rows — one per served `verified_checks` sentence
 * (`OrderPipelineResponse`, same ruling), each a claim only the pipeline can
 * make, with the drawn green VERIFIED capsule.
 *
 * The gate half is unchanged: `gate_open` is read, never derived
 * (`intake.ts`), and `GapKind` is the server's three-member taxonomy. An empty
 * gap array does not mean the gate is open — the caller may be scoped out.
 */
export function DeterministicChecks(props: {
  readonly gateOpen: boolean | undefined;
  readonly gaps: readonly CompletenessGap[] | undefined;
  /** The pipeline's own verified sentences. Absent = that read has not landed. */
  readonly verifiedChecks: readonly string[] | undefined;
}) {
  return (
    <section className="flex flex-col gap-4 bg-surface-sunken p-12">
      <HubSectionLabel>
        Deterministic Verification Checks
        {props.gateOpen !== undefined && (
          <span
            data-testid="gate-state"
            data-gate-open={props.gateOpen}
            className={`rounded-pill border px-5 py-1 text-label font-bold leading-flat ${
              props.gateOpen ? GATE.open : GATE.closed
            }`}
          >
            {props.gateOpen ? "Gate open" : "Gate closed"}
          </span>
        )}
      </HubSectionLabel>

      {props.verifiedChecks !== undefined && props.verifiedChecks.length > 0 && (
        <ul data-testid="verified-checks" className="flex flex-col gap-2">
          {props.verifiedChecks.map((sentence) => (
            <li
              key={sentence}
              className="flex items-center justify-between gap-6 rounded-lg p-4 text-meta hover:bg-surface-panel"
            >
              <span className="flex min-w-0 items-center gap-5 text-ink-secondary">
                <span aria-hidden className="font-mono font-bold text-state-settled">
                  ✓
                </span>
                <span className="min-w-0 leading-body">{sentence}</span>
              </span>
              <span className="shrink-0 rounded-pill bg-state-settled-surface px-4 py-1 font-mono text-label font-bold leading-flat text-state-settled">
                VERIFIED
              </span>
            </li>
          ))}
        </ul>
      )}

      {props.gaps === undefined ? (
        <p className="text-meta leading-body text-ink-muted">
          The server has not answered for this order's gate.
        </p>
      ) : props.gaps.length === 0 ? (
        <Empty
          title="No gaps raised"
          reason="The gate raised nothing against this package. That is the server's list, not a filter — a gap you cannot see is a gap that is not on it."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {props.gaps.map((gap) => (
            <GapRow key={gap.id} gap={gap} />
          ))}
        </ul>
      )}
    </section>
  );
}

const GATE = {
  open: "border-state-settled-border bg-state-settled-surface text-state-settled",
  closed: "border-state-halt-border bg-state-halt-surface text-state-halt",
} as const;
