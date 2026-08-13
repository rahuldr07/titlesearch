import type { OrderSignoffLine } from "@titlepipe/contract";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";

/**
 * "DISCLOSURE · ABSTRACTOR SAID NO" — the design's `:942-961`, moved (per the
 * 2026-07-28 revision, HANDOFF §11) to sit above the draft report rather than
 * buried in the sign-off block: a NO at intake is not a fact about the
 * document, it is a gap the reviewer inherits and must see before reading the
 * report it affects.
 *
 * ONE CARD PER "NO" LINE, SOURCED FROM THE REAL SIGN-OFF RECORD —
 * `GET /api/orders/{id}/signoff`, the same endpoint `QuestionsScreen` reads,
 * now read per-order from the review screen instead of the hardcoded demo id.
 * The comment is the abstractor's own words, quoted verbatim: this panel
 * never re-answers the line, it decides whether the report can ship with the
 * gap disclosed.
 *
 * CONTRACT GAP: no endpoint accepts or escalates a disclosure — `Escalation`
 * covers a FIELD, not a sign-off line, and nothing on `OrderSignoffLine`
 * records a reviewer's later decision about a NO. Both controls render
 * visible and disabled, same as `SignoffCard`'s "Start pipeline" and
 * `ResolveCard`'s buttons — the affordance says the decision exists, the
 * client does not invent where it goes.
 */
export function NoDisclosureCards({ lines }: { lines: readonly OrderSignoffLine[] }) {
  const disclosures = lines.filter((line) => line.answer === "NO");

  if (disclosures.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {disclosures.map((line) => (
        <Card
          key={line.line_id}
          accent="attend"
          data-testid={`no-disclosure-${line.line_id}`}
        >
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <Eyebrow variant="caption" tone="attend">
                Disclosure · abstractor said NO
              </Eyebrow>
            </div>

            <p className="text-sm font-semibold text-ink-primary">
              Sign-off line {line.n} · {line.label}
            </p>

            <p className="border-l-2 border-state-attend-border pl-5 font-quote text-sm leading-open text-ink-secondary">
              The abstractor answered NO — &ldquo;{line.comment}&rdquo;
            </p>

            <p className="text-xs leading-body text-ink-secondary">
              You&rsquo;re not re-answering the line — deciding whether the report can
              ship with this gap disclosed.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button
                size="md"
                tone="settled"
                fill="outlined"
                className="min-w-38 flex-1"
                disabled
              >
                ✓ Accept as stated
              </Button>
              <Button
                size="md"
                tone="attend"
                fill="outlined"
                className="min-w-38 flex-1"
                disabled
              >
                ↗ Escalate
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
