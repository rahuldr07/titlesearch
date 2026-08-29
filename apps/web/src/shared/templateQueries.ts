import { TemplateResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** `GET /api/templates` — the report shape, its scoped samples and the compiled spec. */
export const templates: ReadDescriptor<TemplateResponse> = {
  path: "/api/templates",
  key: ["templates"],
  schema: TemplateResponse,
};
