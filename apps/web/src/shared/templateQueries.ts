import { TemplateCatalogResponse, TemplateDetailResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * The Templates Architect reads. `GET /api/templates` is the catalog (cards
 * plus the two filter vocabularies); `GET /api/templates/{id}` is one
 * template whole — blocks, wording, baselines, tokens, NA matrices, samples
 * and the compiled spec. The id is part of the detail's cache key.
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
