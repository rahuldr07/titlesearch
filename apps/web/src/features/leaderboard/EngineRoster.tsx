import type { Engine } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { engines } from "../../shared/engineQueries";
import { Empty, Table, type TableColumn } from "../../components/ui";
import { QueryState } from "../../entities/state/QueryState";

/**
 * THE ROSTER — WHAT EACH ENGINE DECLARES ABOUT ITSELF.
 *
 * `Engine` (`entities.ts:250-256`) carries four fields and this table draws all
 * four: `id`, `kind`, `enabled`, `adapter_version`. Nothing is inferred from
 * anything else.
 *
 * ══ `kind` IS A DECLARATION, NOT A MEASUREMENT ═════════════════════════════
 *
 * AGENTS.md: "capabilities declared, not faked." `kind` is what the adapter
 * says it is — `vlm_image`, `ocr_text` or `hybrid` (`enums.ts:91`) — and this
 * screen prints that string verbatim rather than deducing a capability from the
 * readings pane. The deduction is available and is exactly the mistake:
 * `pdftotext` returns `null` accuracy on every scan-heavy section, and a screen
 * that concluded "no capability on scans" from those nulls would have invented
 * a capability model out of measurements. The null means the engine declared
 * nothing there; the roster is where declarations live.
 *
 * ══ WHY THERE IS NO "AGREEMENT" OR "ENSEMBLE" COLUMN ═══════════════════════
 *
 * AGENTS.md: "Engines never see each other's output." A column comparing one
 * engine's reading to another's is a rendering of a comparison the pipeline
 * refuses to make, and it would read as though the engines were voting. They
 * are not. Each cell in the readings pane is one engine against the golden set
 * and nothing else.
 *
 * ══ `adapter_version` IS DATA ══════════════════════════════════════════════
 *
 * Rule 3 — a version string is an identifier somebody types into a bug report,
 * so it is mono. `enabled` is a boolean and is rendered as words rather than as
 * a capsule: rule 6 spends a coloured capsule only at a moment of record, and a
 * roster row is not one.
 */
export function EngineRoster() {
  const roster = useRead(engines);

  return (
    <section aria-labelledby="engine-roster-heading" className="flex min-h-0 flex-col gap-6">
      <h2
        id="engine-roster-heading"
        className="text-label font-bold leading-flat text-ink-muted"
      >
        Each engine, as its adapter declares itself
      </h2>
      <QueryState query={roster} of="the engine roster">
        {(data) => (
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line-strong bg-surface-panel">
            <Table
              label="Engine roster"
              rows={data.engines}
              columns={ROSTER_COLUMNS}
              rowKey={(engine) => engine.id}
              empty={
                <Empty
                  title="No engines declared"
                  reason="The roster came back empty. Nothing on this screen filters it — this is the server's whole answer."
                />
              }
            />
          </div>
        )}
      </QueryState>
    </section>
  );
}

const ROSTER_COLUMNS: TableColumn<Engine>[] = [
  {
    id: "id",
    header: "Engine",
    width: "minmax(0,1.6fr)",
    cell: (engine) => (
      <span className="truncate font-mono text-meta leading-close font-semibold text-ink-primary">
        {engine.id}
      </span>
    ),
  },
  {
    id: "kind",
    header: "Declared kind",
    width: "minmax(0,1fr)",
    cell: (engine) => (
      <span className="truncate font-mono text-meta leading-close text-ink-secondary">
        {engine.kind}
      </span>
    ),
  },
  {
    id: "enabled",
    header: "In the ensemble",
    width: "minmax(0,1fr)",
    cell: (engine) => (
      <span className="truncate text-meta leading-close text-ink-secondary">
        {engine.enabled ? "Enabled" : "Not enabled"}
      </span>
    ),
  },
  {
    id: "adapter",
    header: "Adapter version",
    width: "minmax(0,1fr)",
    cell: (engine) => (
      <span className="truncate font-mono text-meta leading-close text-ink-secondary">
        {engine.adapter_version}
      </span>
    ),
  },
];
