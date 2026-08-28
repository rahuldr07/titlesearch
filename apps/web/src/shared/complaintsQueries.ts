import { ComplaintsResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** `endpoints.ts:658` ships the schema with no companion `type` to import. */
type ComplaintsShape = ReturnType<typeof ComplaintsResponse.parse>;

export const complaints: ReadDescriptor<ComplaintsShape> = {
  path: "/api/complaints",
  key: ["complaints"],
  schema: ComplaintsResponse,
};
