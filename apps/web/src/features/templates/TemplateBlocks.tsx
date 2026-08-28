import type { TemplateBlock } from "@titlepipe/contract";
import { Card, CardHeader, CardBody, StatusMark } from "../../components/ui";

/**
 * THE NUMBERED BLOCK LIST. `included` is the server's answer and the only thing
 * that decides whether a block ships — nothing here re-derives it from the note,
 * the numeral or the position.
 */
export function TemplateBlocks({ blocks }: { readonly blocks: readonly TemplateBlock[] }) {
  return (
    <Card padding="none">
      <CardHeader>
        <span>Report blocks</span>
        <span className="font-sans text-label leading-flat font-medium text-ink-faint">
          Inclusion is the server&rsquo;s
        </span>
      </CardHeader>
      <ul>
        {blocks.map((block) => (
          <li
            key={block.id}
            className="flex items-start gap-8 border-b border-line-subtle px-12 py-8 last:border-b-0"
          >
            {/* Rule 3: a numeral is the block's identifier in the compiled spec. */}
            <span className="w-16 shrink-0 pt-1 text-right font-mono text-meta leading-close font-semibold text-ink-muted">
              {block.numeral}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="font-sans text-body leading-close font-semibold text-ink-primary">
                {block.title}
              </span>
              <span className="font-sans text-meta leading-body text-ink-secondary">
                {block.note}
              </span>
            </div>
            <span className="shrink-0 pt-1">
              {block.included ? (
                <StatusMark mark="settled" label="Included" resting />
              ) : (
                <span className="font-sans text-meta leading-close font-semibold text-ink-muted">
                  Not included
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <CardBody className="border-t border-line-subtle">
        <p className="font-sans text-meta leading-body text-ink-muted">
          A block marked not included is absent from the client copy. The shape says so;
          this screen does not work it out.
        </p>
      </CardBody>
    </Card>
  );
}
