import type { ReactNode } from "react";
import { Card, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * One catalogue entry: what the state IS on top, what it LOOKS LIKE underneath.
 *
 * The split is the whole value of the gallery. Prose alone is a style guide
 * nobody checks against; a swatch alone is a screenshot that stops being true
 * the week after it is taken. Naming the state and rendering the real component
 * side by side means a drift shows up as a contradiction on one card.
 *
 * The sample sits on `surface-app`, not on the card's own panel, because that
 * is the surface these states appear on in production. A tinted block on white
 * reads with more contrast than the same block in situ, which would let a
 * genuinely too-quiet state pass its own audit.
 */
export function StateCard({
  tag,
  title,
  desc,
  children,
}: {
  tag: string;
  title: string;
  desc: string;
  /** The live component, rendered exactly as the product renders it. */
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-col items-start gap-2 px-7">
        <Eyebrow variant="screen" className="font-bold tracking-label">
          {tag}
        </Eyebrow>
        <h2 className="text-md font-semibold text-ink-primary">{title}</h2>
        <p className="text-xs leading-body text-ink-secondary">{desc}</p>
      </CardHeader>

      <div className="flex min-h-59 flex-1 items-center justify-center bg-surface-app px-7 py-8">
        <div className="w-full">{children}</div>
      </div>
    </Card>
  );
}
