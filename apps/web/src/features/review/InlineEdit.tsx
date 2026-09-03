import { useState } from "react";
import { fieldLabel } from "./fieldNaming";

export function InlineEdit(props: {
  readonly path: string;
  readonly initial: string;
  readonly pending: boolean;
  readonly onSave: (value: string) => void;
  readonly onCancel: () => void;
}) {
  const [value, setValue] = useState(props.initial);

  const keys = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      props.onCancel();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!props.pending) props.onSave(value);
  };

  const box =
    "w-full rounded-md border border-control-border bg-surface-panel px-4 py-2 outline-none focus-visible:border-action";

  return (
    <div
      data-testid={`inline-edit-${props.path}`}
      className="grid w-full grid-cols-[140px_minmax(0,1fr)_70px_24px] items-start gap-6 rounded-lg border border-action-border bg-action-surface px-4 py-5"
    >
      <span className="truncate text-label leading-flat font-semibold text-ink-muted">
        {fieldLabel(props.path)}
      </span>

      <span className="flex min-w-0 flex-col gap-2">
        <input
          autoFocus
          data-testid="inline-value"
          aria-label="The value it should have been"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={keys}
          className={`${box} font-mono text-meta leading-close font-semibold text-ink-primary`}
        />
        <span className="font-mono text-label leading-flat text-ink-muted">
          ↵ Enter saves · Esc cancels
        </span>
      </span>

      <span />
      <span />
    </div>
  );
}
