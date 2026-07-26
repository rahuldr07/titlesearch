import type { Field } from "@titlepipe/contract";
import { useState } from "react";
import { parseLineCoords, type NormRect } from "../../components/coords";
import { diffChars, readingsDiffer } from "../../entities/field/charDiff";
import { fieldLabel } from "../../entities/field/FieldRow";
import { NoValue } from "../../entities/field/NoValue";
import { noValueOf } from "../../entities/field/noValueState";
import { ReadingCard } from "../../entities/field/ReadingCard";
import { StatePill } from "../../entities/field/StatePill";
import { FieldActions } from "./FieldActions";

/**
 * The selected field, opened up: what the engines read, and why it is a
 * person's problem.
 *
 * DELIBERATELY DEPARTS FROM design-mock/ — logged as conflict C7. The design
 * draws one `current` value plus one anonymous `suggested` alternative. That
 * presents an engine's answer as a recommendation with no attribution and no
 * provenance of its own, which is principle 6's failure shape and inverts the
 * routing rule. CONTEXT §8.3 requires the review UI to show A and B with their
 * engine ids, so both readings render, attributed, and NEITHER is pre-selected.
 *
 * The design's best idea is kept: framing the field as a QUESTION rather than a
 * form row. That reads far better than the old two-column layout.
 *
 * Nothing here ranks the readings. Order is seat order (A, B) as the server
 * returned them — not confidence, not cost, not latency.
 */
export function DecisionPanel({
  field,
  orderId,
  onSettled,
  onPin,
}: {
  field: Field;
  orderId: string;
  onSettled: () => void;
  onPin: (p: { engineId: string; seat: string; rects: NormRect[] }) => void;
}) {
  /**
   * The value a reviewer chose to adopt from a reading, and a counter so
   * adopting the SAME value twice still re-opens the editor. Held here rather
   * than in FieldActions because the reading cards are siblings of the actions,
   * not children.
   */
  const [adopted, setAdoptedRaw] = useState<{
    value: string;
    n: number;
  } | null>(null);
  const setAdopted = (value: string) =>
    setAdoptedRaw((prev) => ({ value, n: (prev?.n ?? 0) + 1 }));

  const noValue = noValueOf(field);
  const readings = field.readings ?? [];
  const disagree = readingsDiffer(readings.map((r) => r.value));

  // Diff the first two readings that actually returned something. An engine
  // that returned nothing is not a dissenting opinion.
  const withValues = readings.filter((r) => r.value !== null);
  const left = withValues[0];
  const right = withValues[1];
  const diff =
    left?.value !== undefined &&
    left.value !== null &&
    right?.value !== undefined &&
    right.value !== null
      ? diffChars(left.value, right.value)
      : null;

  const segmentsFor = (index: number, value: string | null) => {
    if (value === null) return [];
    if (diff === null) return [{ text: value, same: true }];
    if (index === 0) return diff.a;
    if (index === 1) return diff.b;
    return [{ text: value, same: true }];
  };

  return (
    <div
      data-testid="decision-panel"
      className="border-b border-line-strong bg-surface-raised px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="sel-label"
          className="text-md font-semibold text-ink-primary"
        >
          {fieldLabel(field.path)}
        </span>
        <StatePill state={field.state} testId="sel-state" />
        {/*
          The field's no-value CONDITION, in its own element beside the state
          pill — never inside it.
          The old UI overloaded `sel-state`: it showed the server's state for
          most fields and the NA reason for unreadable ones. Two different facts
          through one element, and it meant the pill could be rewritten by the
          client for special cases — which is exactly what §0.2 forbids.
          Without this the panel said "NEEDS REVIEW" and nothing at all about the
          field being unreadable, so the reviewer had to infer the condition from
          the row behind the panel.
        */}
        {noValue === null ? null : (
          <span data-testid="sel-navalue">
            <NoValue state={noValue} />
          </span>
        )}
        {disagree ? (
          <span
            data-testid="sel-disagree"
            className="rounded-xs border border-state-attend-border bg-state-attend-surface px-2 py-px text-micro font-bold tracking-badge text-state-attend uppercase"
          >
            A≠B
          </span>
        ) : null}
      </div>

      {disagree ? (
        <p
          data-testid="why-yours"
          className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary"
        >
          Two readers read this page independently and returned different
          values. Nothing merged — that disagreement is why this field is yours.
          Neither reading is preferred; the page decides.
        </p>
      ) : null}

      {readings.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          No per-engine readings were returned for this field.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {readings.map((r, i) => (
            <ReadingCard
              key={r.id}
              reading={r}
              seat={i === 0 ? "A" : i === 1 ? "B" : String(i + 1)}
              segments={segmentsFor(
                withValues.findIndex((w) => w.id === r.id),
                r.value,
              )}
              onAdopt={setAdopted}
              onPin={
                parseLineCoords(r.line_coords).length === 0
                  ? undefined
                  : () =>
                      onPin({
                        engineId: r.engine_id,
                        seat: i === 0 ? "A" : i === 1 ? "B" : String(i + 1),
                        rects: parseLineCoords(r.line_coords),
                      })
              }
            />
          ))}
        </div>
      )}

      <FieldActions
        field={field}
        orderId={orderId}
        onSettled={onSettled}
        adopted={adopted}
      />
    </div>
  );
}
