import { useState } from "react";
import type { TemplateDetailResponse } from "@titlepipe/contract";
import { Button, Segment, SegmentedControl, Textarea } from "../../components/ui";
import { InspectorOverrides } from "./InspectorOverrides";
import { AuditPanelTab, NaMatrixPanel } from "./InspectorPanels";
import { interpolate } from "./useTemplates";

type InspectorTab = "syntax" | "na" | "overrides" | "audit";

/**
 * The inspector column — Syntax · Null states · Overrides · Audit. Syntax
 * edits the active block's sentence-format expression as a draft the screen
 * holds until Save posts it; the token palette and the live preview
 * interpolate the server's token samples. Null states prints the four
 * declared absence strings — never collapsed, each under its numbered name.
 */
export function TemplateInspector({
  template,
  blockKey,
  wording,
  onWording,
  onReset,
}: {
  readonly template: TemplateDetailResponse;
  readonly blockKey: string;
  readonly wording: string;
  readonly onWording: (value: string) => void;
  readonly onReset: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("syntax");
  const block = template.blocks.find((b) => b.key === blockKey) ?? null;

  return (
    <div className="flex w-160 shrink-0 flex-col overflow-hidden border-l border-line-strong bg-surface-panel">
      <div className="shrink-0 border-b border-line-subtle bg-surface-sunken p-5">
        <SegmentedControl
          label="Inspector tabs"
          selectedKeys={new Set([tab])}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            setTab(
              next === "na" ? "na" : next === "overrides" ? "overrides" : next === "audit" ? "audit" : "syntax",
            );
          }}
        >
          <Segment id="syntax">Syntax</Segment>
          <Segment id="na">Null states</Segment>
          <Segment id="overrides">Overrides</Segment>
          <Segment id="audit">Audit</Segment>
        </SegmentedControl>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-8">
        {tab === "syntax" && block !== null && (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-line-subtle pb-5">
              <span className="flex flex-col">
                <span className="font-sans text-label leading-flat font-bold text-ink-muted">
                  Active block
                </span>
                <span className="font-sans text-meta leading-close font-bold text-ink-primary">
                  {block.title}
                </span>
              </span>
              <span className="rounded-pill bg-action-surface px-4 py-1 font-mono text-label leading-flat font-semibold text-ink-secondary">
                {`${block.key}.*`}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-sans text-label leading-flat font-bold text-ink-primary">
                  Sentence format expression
                </span>
                <Button variant="ghost" size="sm" data-testid="wording-reset" onPress={onReset}>
                  ↺ Reset
                </Button>
              </div>
              <Textarea
                data-testid="wording-input"
                aria-label="Sentence format expression"
                value={wording}
                onChange={(event) => onWording(event.target.value)}
                rows={4}
                className="font-mono"
              />
            </div>

            <div className="flex flex-col gap-3">
              <span className="flex items-baseline justify-between font-sans text-label leading-flat">
                <span className="font-bold text-ink-primary">Available variables</span>
                <span className="text-ink-muted">Click to insert</span>
              </span>
              <div className="flex flex-wrap gap-3">
                {block.tokens.map(({ token, sample }) => (
                  <Button
                    key={token}
                    variant="ghost"
                    size="sm"
                    data-testid={`token-${token}`}
                    aria-label={`Insert ${token} (e.g. ${sample})`}
                    className="rounded-pill border border-action-border bg-action-surface font-mono text-label text-ink-secondary"
                    onPress={() => {
                      onWording(wording === "" || wording.endsWith(" ") ? wording + token : `${wording} ${token}`);
                    }}
                  >
                    {token}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-line-strong bg-surface-sunken p-6">
              <span className="block pb-2 font-sans text-label leading-flat font-bold text-ink-secondary">
                Live output preview
              </span>
              <span data-testid="live-preview" className="font-sans text-label leading-body text-ink-primary">
                {interpolate(wording, block.tokens)}
              </span>
            </div>

            <p className="rounded-md border border-line-subtle bg-surface-sunken p-5 font-sans text-label leading-body text-ink-muted">
              <span className="font-bold">System constraint:</span> client
              templates dictate formatting and syntax. Structural inclusion and
              search depth remain governed immutably by product overlays.
            </p>
          </>
        )}

        {tab === "na" && block !== null && <NaMatrixPanel block={block} />}

        {tab === "overrides" && <InspectorOverrides />}

        {tab === "audit" && <AuditPanelTab template={template} />}
      </div>
    </div>
  );
}
