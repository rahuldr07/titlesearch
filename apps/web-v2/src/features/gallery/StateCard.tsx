import type { ReactNode } from "react";
import { Card, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

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
 *
 * `surface="panel"` IS THE ONE EXCEPTION, AND IT IS A BUG BEING WORKED AROUND.
 * `NoValue`'s `not_found` chip is filled `surface-app` — correct in the report,
 * where the row sits on a panel (export :1009) — so drawn on an app-surface
 * cell its fill is literally invisible and `not_found` collapses to a bare
 * outline one hairline from `silent`. That is the exact collision this card
 * exists to catch, happening ON the card. The real fix is a surface-aware fill
 * on `NoValue` (`entities/field`); until then the sample cell moves rather than
 * the catalogue quietly showing five states where it names six.
 */
const SURFACE = {
  app: "bg-surface-app",
  panel: "bg-surface-panel",
} as const;

export function StateCard({
  tag,
  title,
  desc,
  surface = "app",
  children,
}: {
  tag: string;
  title: string;
  desc: string;
  surface?: keyof typeof SURFACE;
  /** The live component, rendered exactly as the product renders it. */
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-col items-start gap-2 px-7">
        <Eyebrow variant="cardTag">{tag}</Eyebrow>
        <h2 className="text-md font-semibold text-ink-primary">{title}</h2>
        <p className="text-xs leading-body text-ink-secondary">{desc}</p>
      </CardHeader>

      <div
        className={cn(
          "flex min-h-59 flex-1 items-center justify-center px-7 py-8",
          SURFACE[surface],
        )}
      >
        <div className="w-full">{children}</div>
      </div>
    </Card>
  );
}
