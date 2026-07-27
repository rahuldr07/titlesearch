import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

interface CoverageRow {
  section: string;
  fields: number;
  note: string | null;
  warn: boolean;
}

/**
 * GOLDEN SET COVERAGE — what the bench will be able to see.
 *
 * A WARNED SECTION IS SHOWN AGAINST ITS GATE, not as a bare count. Six seeded
 * fields is meaningless alone; six against a threshold of forty says the exact
 * thing that matters — judgments stay human-reviewed until coverage crosses it,
 * and no amount of prompt work changes that. The target comes from the server,
 * never a literal in this file.
 *
 * The warning is not an error and does not read as one. A thin seed is a
 * statement about how much reading has happened, not about anybody's work.
 */
export function CoverageList({
  coverage,
  judgmentTarget,
}: {
  coverage: readonly CoverageRow[];
  judgmentTarget: number;
}) {
  return (
    <Card>
      <CardHeader filled>
        <Eyebrow variant="section">
          Golden set coverage by section — what the bench will be able to see
        </Eyebrow>
      </CardHeader>
      <CardBody className="p-0">
        <ul>
          {coverage.map((row) => (
            <li
              key={row.section}
              data-testid={`coverage-${row.section}`}
              className="grid gap-2 border-t border-line-subtle px-8 py-4 first:border-t-0 sm:grid-cols-[12rem_8rem_1fr]"
            >
              <span className="font-mono text-xs text-ink-primary">{row.section}</span>
              <span className="font-mono text-xs text-ink-primary">
                {row.fields}
                {row.warn ? ` of ≥${judgmentTarget}` : ""}
              </span>
              <span
                className={
                  row.warn
                    ? "text-tiny leading-body text-state-attend-ink"
                    : "text-tiny leading-body text-ink-muted"
                }
              >
                {row.note ?? ""}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
