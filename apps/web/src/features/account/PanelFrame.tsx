/**
 * The pane header, shared by all six — the one thing every pane has in
 * common, so it lives here rather than six times.
 */
export function PanelFrame(props: {
  readonly title: string;
  readonly note: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-title font-semibold leading-tight text-ink-primary">
          {props.title}
        </h2>
        <p className="text-meta leading-body text-ink-secondary">{props.note}</p>
      </div>
      {props.children}
    </section>
  );
}
