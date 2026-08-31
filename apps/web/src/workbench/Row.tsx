import type { ReactNode } from "react";

/**
 * One labelled band of the workbench. Its own file because a module whose
 * only other export is a `createRoot` call cannot fast-refresh while it
 * also exports a component.
 */
export function Row(props: {
  readonly title: string;
  readonly note?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="mb-6 flex items-baseline gap-8">
        <h2 className="text-subject font-semibold text-ink-primary">{props.title}</h2>
        {props.note !== undefined && (
          <span className="text-meta text-ink-muted">{props.note}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-8">{props.children}</div>
    </section>
  );
}
