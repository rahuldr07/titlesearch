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
  const detail = useRead(
    // A stable descriptor even while the catalog loads; disabled below.
    templateDetail(activeId ?? "none"),
  );
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
                      const baseline = tpl.blocks.find((b) => b.key === blockKey)?.baseline;
                      if (baseline !== undefined) {
                        setDrafts((prev) => ({ ...prev, [blockKey]: baseline }));
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
