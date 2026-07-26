import type { ReactNode } from "react";

/**
 * The page shell every rebuilt screen sits in: an eyebrow, a title, optional
 * lede, optional right-hand actions, then the body.
 *
 * Exists so screens cannot each invent their own header spacing and type scale.
 * design-mock uses this shape on every full-width screen (Queue, Overview,
 * Completeness, Clients, Audit, Rulebook, Products).
 */
export function ScreenFrame({
  eyebrow,
  title,
  lede,
  actions,
  width = "wide",
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
  /** design-mock uses a narrow single column for flows, wide for boards */
  width?: "narrow" | "wide" | "full";
  children: ReactNode;
}) {
  const max =
    width === "narrow"
      ? "max-w-[640px]"
      : width === "wide"
        ? "max-w-[900px]"
        : "max-w-[1340px]";

  return (
    <div className="h-full overflow-auto bg-surface-app px-8 py-7">
      <div className={`mx-auto ${max}`}>
        <div className="mb-5 flex flex-wrap items-end gap-4">
          <div className="min-w-[280px] flex-1">
            <div className="mb-2 text-micro font-semibold tracking-eyebrow text-page-ref uppercase">
              {eyebrow}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink-primary">
              {title}
            </h1>
            {lede === undefined ? null : (
              <p className="mt-1 max-w-[60ch] text-base leading-relaxed text-ink-secondary">
                {lede}
              </p>
            )}
          </div>
          {actions === undefined ? null : <div>{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
