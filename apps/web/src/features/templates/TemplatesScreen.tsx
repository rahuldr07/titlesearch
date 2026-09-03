import { useState } from "react";
import type { TemplateDetailResponse } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { usePermissions, hasAction } from "../../app/session/permissions";
import { useSignedIn } from "../../app/session/signedIn";
import { templateCatalog, templateDetail } from "../../shared/templateQueries";
import { QueryState } from "../../entities/state/QueryState";
import { TemplateRail } from "./TemplateRail";
import { TemplateCanvas } from "./TemplateCanvas";
import { TemplateInspector } from "./TemplateInspector";
import type { NaModeId } from "./useTemplates";

export type TemplateView = "sheet" | "diff" | "json";
export type NaSimMode = "normal" | NaModeId;

/**
 * Templates Architect — three columns: catalog rail left, live sheet /
 * split diff / JSON schema centre under the NA simulation bar, inspector
 * right. Wording edits live here as drafts until Save posts them — the
 * server owns the accepted copy, and switching templates drops unsaved
 * drafts, exactly as an editor that never told the server anything must.
 */
export function TemplatesScreen() {
  const catalog = useRead(templateCatalog);
  const permissions = usePermissions(useSignedIn((s) => s.account !== null));
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState<TemplateView>("sheet");
  const [naMode, setNaMode] = useState<NaSimMode>("normal");
  const [blockKey, setBlockKey] = useState<string>("vesting");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const templates = catalog.data?.templates ?? [];
  const activeId = picked ?? templates[0]?.id ?? null;
  /* A stable descriptor even while the catalog loads; the second argument
     holds the request until there is an id to ask about. */
  const detail = useRead(templateDetail(activeId ?? "none"), activeId !== null);
  const maySave = hasAction(permissions.data?.rules, "template.edit");

  const pick = (id: string) => {
    setPicked(id);
    setDrafts({});
    setBlockKey("vesting");
  };

  const wordingOf = (tpl: TemplateDetailResponse, key: string): string =>
    drafts[key] ?? tpl.blocks.find((b) => b.key === key)?.wording ?? "";

  return (
    <div
      data-testid="templates-screen"
      className="tp-screen-enter flex h-full min-h-0 w-full overflow-hidden"
    >
      <QueryState query={catalog} of="the template catalog">
        {(data) => (
          <>
            <TemplateRail
              catalog={data}
              activeId={activeId}
              onPick={pick}
              samples={detail.data?.samples ?? []}
              activeClient={detail.data?.client ?? null}
            />
            <QueryState query={detail} of="this template">
              {(tpl) => (
                <>
                  <TemplateCanvas
                    template={tpl}
                    view={view}
                    onView={setView}
                    naMode={naMode}
                    onNaMode={setNaMode}
                    blockKey={blockKey}
                    onBlock={setBlockKey}
                    wordingOf={(key) => wordingOf(tpl, key)}
                    drafts={drafts}
                    maySave={maySave}
                  />
                  <TemplateInspector
                    template={tpl}
                    blockKey={blockKey}
                    wording={wordingOf(tpl, blockKey)}
                    onWording={(value) => {
                      setDrafts((prev) => ({ ...prev, [blockKey]: value }));
                    }}
                    onReset={() => {
                      /*
                       * `wording`, NOT `baseline`. Reset discards the unsaved
                       * draft and returns the box to what the server holds —
                       * which is the client's saved wording. `baseline` is the
                       * product default the Split Diff compares against (see
                       * TemplateDiff's header), so resetting to it would stage
                       * the generic text as an edit and a following Save would
                       * overwrite the client's customisation with it.
                       */
                      const saved = tpl.blocks.find((b) => b.key === blockKey)?.wording;
                      if (saved !== undefined) {
                        setDrafts((prev) => ({ ...prev, [blockKey]: saved }));
                      }
                    }}
                  />
                </>
              )}
            </QueryState>
          </>
        )}
      </QueryState>
    </div>
  );
}
