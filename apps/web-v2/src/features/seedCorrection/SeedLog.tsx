import type { GoldenField } from "@titlepipe/contract";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { formatRecordingDate } from "../../shared/date";

/**
 * WHICH OF THE THREE ACTIONS HAPPENED IS READ BACK OFF THE RECORD, never
 * remembered from the click. `corrected_from` is set only when the value moved;
 * `suspect` is set only by a demotion. The client keeps no memory of what it
 * just did, so a refresh, a second tab and a colleague's screen all describe
 * the same event the same way.
 */
function describe(field: GoldenField): { head: string; body: string } | null {
  if (field.corrected_at === null) return null;
  const who = field.corrected_by ?? "unknown";
  const why = field.correction_reason ?? "";

  if (field.tag === "suspect") {
    return { head: `${who} — demoted to suspect`, body: why };
  }
  if (field.corrected_from !== null) {
    return {
      head: `${who} — corrected`,
      body: `${field.corrected_from} → ${field.value} · ${field.source_citation ?? "no citation"} · ${why}`,
    };
  }
  return { head: `${who} — confirmed the seed`, body: `value stands — ${field.value} · ${why}` };
}

export function SeedLog({ field }: { field: GoldenField }) {
  const entry = describe(field);
  const stamp = field.corrected_at;

  return (
    <section className="flex flex-col gap-4">
      <Eyebrow variant="section">
        Correction log — this field only. Permanent and visible; the audit trail
        is the point.
      </Eyebrow>
      <div data-testid="seed-log" className="flex flex-col gap-3">
        {entry === null ? (
          <p className="text-base leading-body text-ink-muted">
            empty — first investigation of this field. A field corrected twice is
            a field someone should look at in person before the blind fifty
            covers it.
          </p>
        ) : (
          <article className="flex flex-col gap-2 border-l-2 border-line-strong pl-6">
            <p className="text-base font-semibold text-ink-primary">
              {entry.head}
              {stamp === null ? null : (
                <span className="ml-3 font-mono text-xs font-normal text-ink-muted">
                  {formatRecordingDate(stamp.slice(0, 10)) ?? stamp.slice(0, 10)}{" "}
                  {stamp.slice(11, 16)}
                </span>
              )}
            </p>
            <p className="font-mono text-xs leading-close text-ink-secondary">{entry.body}</p>
          </article>
        )}
      </div>
    </section>
  );
}
