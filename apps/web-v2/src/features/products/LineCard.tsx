import type { ConfigLine } from "@titlepipe/contract";

import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";

import { LineTag } from "./LineTag";

/**
 * One catalogue entry.
 *
 * The card prints the VERSION beside the id, always, even at v1. A line's
 * wording is what an abstractor asserted against, so an order records which
 * version it answered — and a catalogue that only showed the current text would
 * make two orders answered against two wordings look like one disagreement.
 *
 * "◆ machine-checked" versus "○ human-answered only" is the other thing the
 * card refuses to leave implicit. It is the difference between a wrong answer
 * something can catch and a wrong answer nothing can, and it belongs on the
 * line rather than in a person's memory of which lines have checks.
 *
 * The standard text is set in the SERIF face. That is a rule, not a flourish:
 * serif renders wording a human is bound to, never machine output.
 */
export function LineCard({
  line,
  canAuthor,
  onEdit,
}: {
  line: ConfigLine;
  canAuthor: boolean;
  onEdit: () => void;
}) {
  return (
    <Card data-testid={`line-${line.id}`} className={line.retired ? "opacity-55" : ""}>
      <div className="px-7 py-6">
        <div className="flex flex-wrap items-baseline gap-5">
          <span className="font-mono text-xs font-semibold text-ink-muted">
            {line.id}
          </span>
          <span className="min-w-80 flex-1 text-md font-medium text-ink-primary">
            {line.label}
          </span>
          <Chip tone="neutral" size="micro">
            {line.group}
          </Chip>
          <span className="font-mono text-tiny text-ink-muted">v{line.version}</span>
          {line.retired ? (
            <Chip tone="neutral" size="micro">
              Retired
            </Chip>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <LineTag>{line.answers.join(" / ")}</LineTag>
          <LineTag>
            {line.comment_on_no ? "Comment required on NO" : "Comment optional on NO"}
          </LineTag>
          {line.period_scoped ? (
            <LineTag tone="action">carries the order period</LineTag>
          ) : null}
          {line.machine_check === null ? (
            <LineTag tone="attend">○ human-answered only</LineTag>
          ) : (
            <LineTag tone="settled">◆ machine-checked: {line.machine_check}</LineTag>
          )}
          {canAuthor ? (
            <span className="ml-auto flex gap-3">
              <Button size="sm" fill="outlined" tone="neutral" onClick={onEdit}>
                Edit
              </Button>
              {/* CONTRACT GAP: retiring a line is a server write with no endpoint. */}
              <Button
                size="sm"
                fill="outlined"
                tone="neutral"
                className="text-state-halt-ink"
                disabled
              >
                Retire
              </Button>
            </span>
          ) : null}
        </div>

        {line.standard_text === null ? null : (
          <p className="mt-4 border-l-2 border-line-strong pl-5 font-quote text-xs leading-open text-ink-secondary">
            Standard text: {line.standard_text}
          </p>
        )}
      </div>
    </Card>
  );
}
