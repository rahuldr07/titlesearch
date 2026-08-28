import type { Key } from "react-aria-components";
import type { Engine, EngineRoutingCell } from "@titlepipe/contract";
import { Input, Label, Option, Select } from "../../components/ui";

/**
 * THE THREE THINGS A SEAT CHANGE NEEDS, AND NOTHING PRE-FILLED.
 *
 * Split out of `SeatChange` on the 150-line gate, and the seam is real: this
 * file is the form's SURFACE and `SeatChange` is the act — state, the mutation,
 * the hold and the refusal. Nothing here knows that a POST exists.
 *
 * ══ NOTHING IS PRE-SELECTED ════════════════════════════════════════════════
 *
 * No default seat, no default engine, no "recommended" mark, and no ordering
 * that puts a high-scoring engine first. AGENTS.md bans auto-tuning: a form
 * that arrives with an answer already in it collects a signature for a choice
 * the screen made, and the evidence field would then be citing the layout.
 *
 * ══ THE CURRENT OCCUPANT IS SHOWN, AND THAT IS NOT A SUGGESTION ════════════
 *
 * Once a seat is chosen the line beneath states who sits there now, who
 * approved it and what they cited. It is the thing being overwritten, and an
 * engineer who cannot see it is filing over a decision they never read. It
 * proposes nothing.
 */
export function SeatFields(props: {
  readonly cells: readonly EngineRoutingCell[];
  readonly engines: readonly Engine[];
  readonly seat: EngineRoutingCell | null;
  readonly cellId: string | null;
  readonly engineId: string | null;
  readonly onCell: (id: string | null) => void;
  readonly onEngine: (id: string | null) => void;
  readonly onEvidence: (value: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-8">
        <Select
          label="The seat"
          placeholder="Which jurisdiction, section and seat…"
          selectedKey={props.cellId}
          onSelectionChange={(key: Key | null) =>
            props.onCell(key === null ? null : String(key))
          }
        >
          {props.cells.map((cell) => (
            <Option key={cell.id} id={cell.id}>
              {`${cell.jurisdiction} · ${cell.section} · seat ${cell.seat}`}
            </Option>
          ))}
        </Select>

        <Select
          label="The engine that takes it"
          placeholder="Which engine…"
          selectedKey={props.engineId}
          onSelectionChange={(key: Key | null) =>
            props.onEngine(key === null ? null : String(key))
          }
        >
          {props.engines.map((engine) => (
            <Option key={engine.id} id={engine.id}>
              {`${engine.id} — ${engine.kind}`}
            </Option>
          ))}
        </Select>

        <div className="flex flex-col gap-4">
          <Label htmlFor="seat-evidence">The evidence this rests on</Label>
          {/* Uncontrolled by design — the kit's `Input` takes no `value`. A
              citation is data, so it is mono (rule 3). */}
          <Input
            id="seat-evidence"
            data
            placeholder="bench://run-…"
            onChange={(event) => props.onEvidence(event.target.value)}
          />
        </div>
      </div>

      {props.seat !== null && (
        <p className="text-meta leading-body text-ink-secondary">
          That seat currently holds{" "}
          <span className="font-mono text-meta text-ink-primary">
            {props.seat.engine_id}
          </span>
          , approved by{" "}
          <span className="font-mono text-meta text-ink-primary">
            {props.seat.approved_by}
          </span>{" "}
          citing{" "}
          <span className="font-mono text-meta text-ink-primary">
            {props.seat.evidence_url}
          </span>
          .
        </p>
      )}
    </>
  );
}
