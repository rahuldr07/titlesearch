import type { ReactNode } from "react";

/**
 * A LABELLED ROW IN A TEMPLATE MODAL, AND ITS ABSENT TWIN.
 *
 * The design draws six rows across the two template modals. Four of them read
 * fields `TemplateResponse` and `TemplateSample` do not carry, so `SpecAbsent`
 * NAMES THE SHAPE that would hold the value rather than printing a plausible
 * one (INVARIANT 42/43). A bounding box, a snippet and a digest are citations;
 * inventing any of them is the one thing this product may never do.
 */
export function SpecValue({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-sans text-label leading-flat font-bold text-ink-muted">{label}</span>
      <span className="font-sans text-meta leading-close text-ink-primary">{children}</span>
    </div>
  );
}

export function SpecAbsent({
  label,
  shape,
  why,
  testId,
}: {
  readonly label: string;
  /** The field, spelled as it would appear on the wire. */
  readonly shape: string;
  /** Why the browser may not stand in for it. */
  readonly why: string;
  readonly testId: string;
}) {
  return (
    <div data-testid={testId} className="flex flex-col gap-2">
      <span className="font-sans text-label leading-flat font-bold text-ink-muted">{label}</span>
      <p className="font-sans text-meta leading-body text-ink-secondary">
        Absent. Nothing on the wire carries it; the shape it would need is{" "}
        {/* Rule 3: a field path is data. */}
        <code className="font-mono text-label text-ink-primary">{shape}</code>. {why}
      </p>
    </div>
  );
}
