import type { CompletenessGap } from "@titlepipe/contract";
import { Empty } from "../../components/ui";
import { HubSectionLabel } from "./HubSectionLabel";
import { GapRow } from "./GapRow";

/**
 * The completeness gate — the package measured against the sign-off, which is
 * what is actually deterministic here. `GapKind` is the server's three-member
 * taxonomy; the design's "checks" named none.
 *
 * `gate_open` is read, never derived (`intake.ts:176`): an empty gap array does
 * not mean the gate is open, because the caller may be scoped out of gaps.
 */
export function DeterministicChecks(props: {
  readonly gateOpen: boolean | undefined;
  readonly gaps: readonly CompletenessGap[] | undefined;
}) {
  return (
    <section className="flex flex-col gap-4 bg-surface-sunken p-12">
      <HubSectionLabel>
        Deterministic checks — the package against the sign-off
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
