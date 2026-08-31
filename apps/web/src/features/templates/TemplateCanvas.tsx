import type { TemplateDetailResponse } from "@titlepipe/contract";
import { Button, Segment, SegmentedControl } from "../../components/ui";
import { ExportSpecDialog } from "./ExportSpecDialog";
import { TemplateSheet } from "./TemplateSheet";
import { TemplateDiff } from "./TemplateDiff";
import { useSaveTemplate } from "./useTemplates";
import { NaSimBar } from "./NaSimBar";
import type { NaSimMode, TemplateView } from "./TemplatesScreen";

/**
 * The centre column — toolbar, NA simulation bar, and the three views
 * (Live Sheet · Split Diff · JSON Schema). Save is live for a seat holding
 * `template.edit` and disabled with the hint for one that does not; the
 * server still refuses with 403 — the button state is a courtesy, never the
 * enforcement.
 */
export function TemplateCanvas({
  template,
  view,
  onView,
  naMode,
  onNaMode,
  blockKey,
  onBlock,
  wordingOf,
  drafts,
  maySave,
}: {
  readonly template: TemplateDetailResponse;
  readonly view: TemplateView;
  readonly onView: (view: TemplateView) => void;
  readonly naMode: NaSimMode;
  readonly onNaMode: (mode: NaSimMode) => void;
  readonly blockKey: string;
  readonly onBlock: (key: string) => void;
  readonly wordingOf: (key: string) => string;
  readonly drafts: Record<string, string>;
  readonly maySave: boolean;
}) {
  const save = useSaveTemplate(template.id);
  const held = !maySave
    ? "Read-only — RBAC grants VIEW access to templates. Save belongs to Engineering."
    : save.pending
      ? "Sending — the server has not answered yet."
      : Object.keys(drafts).length === 0
        ? "Nothing edited yet — the server already holds this wording."
        : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-6 border-b border-line-strong bg-surface-panel px-8 py-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="truncate font-sans text-body leading-close font-bold text-ink-primary">
            {template.name}
          </span>
          <span className="shrink-0 rounded-pill border border-action-border-strong bg-action-surface px-4 py-1 font-sans text-label leading-flat font-semibold text-ink-secondary">
            {template.client}
          </span>
          <span className="shrink-0 rounded-pill bg-surface-sunken px-4 py-1 font-mono text-label leading-flat text-ink-muted">
            {`${template.product} (${template.version})`}
          </span>
        </div>
        <SegmentedControl
          label="Template views"
          selectedKeys={new Set([view])}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            onView(next === "diff" ? "diff" : next === "json" ? "json" : "sheet");
          }}
        >
          <Segment id="sheet">Live sheet</Segment>
          <Segment id="diff">Split diff</Segment>
          <Segment id="json">JSON schema</Segment>
        </SegmentedControl>
        <div className="flex items-center gap-4">
          <ExportSpecDialog template={template} />
          <Button
            variant="primary"
            size="sm"
            data-testid="template-save"
            disabledBecause={held}
            onPress={() => save.save(drafts)}
          >
            {save.pending ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>

      {!maySave && (
        /* The read-only banner, drawn for a seat without the grant —
           visible and disabled, not absent. */
        <p
          data-testid="template-readonly-banner"
          className="shrink-0 border-b border-state-attend-border bg-state-attend-surface px-8 py-3 font-sans text-label leading-close text-state-attend"
        >
          Read-only — RBAC grants VIEW access to templates. Editing and publishing are
          disabled.
        </p>
      )}

      <NaSimBar naMode={naMode} onNaMode={onNaMode} />

      <div
        tabIndex={0}
        role="region"
        aria-label="Template canvas"
        className="tp-state flex min-h-0 flex-1 justify-center overflow-y-auto bg-surface-app p-12"
      >
        {view === "sheet" ? (
          <TemplateSheet
            template={template}
            naMode={naMode}
            blockKey={blockKey}
            onBlock={onBlock}
            wordingOf={wordingOf}
          />
        ) : view === "diff" ? (
          <TemplateDiff template={template} wordingOf={wordingOf} />
        ) : (
          <div className="w-full max-w-420">
            <p className="pb-4 font-sans text-label leading-body text-ink-muted">
              Compiled template manifest spec — deterministic schema the render workers
              consume, as the server emits it.
            </p>
            <pre
              data-testid="template-json"
              className="overflow-x-auto rounded-md border border-line-subtle bg-surface-sunken p-8 font-mono text-label leading-body text-ink-primary"
            >
              <code>{template.export_spec}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
