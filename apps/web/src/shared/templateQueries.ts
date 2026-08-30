import { TemplateCatalogResponse, TemplateDetailResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * ⚠ RULED 2026-08-29 (RULING-2026-08-29.md) — the Templates Architect reads.
 * `GET /api/templates` is the CATALOG (cards + the two filter vocabularies);
 * `GET /api/templates/{id}` is one template whole — blocks, wording,
 * baselines, tokens, NA matrices, samples and the compiled spec. The id is
 * part of the detail's cache key: switching templates is a different read.
 */
export const templateCatalog: ReadDescriptor<TemplateCatalogResponse> = {
  path: "/api/templates",
  key: ["templates"],
  schema: TemplateCatalogResponse,
};

export function templateDetail(id: string): ReadDescriptor<TemplateDetailResponse> {
  return {
    path: `/api/templates/${id}`,
    key: ["templates", id],
    schema: TemplateDetailResponse,
  };
}
