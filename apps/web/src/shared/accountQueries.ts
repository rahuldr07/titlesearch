import {
  AuditResponse,
  RulesResponse,
  MeProfileResponse,
  PeopleResponse,
  PreferencesResponse,
  type Rule,
} from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** THE ACCOUNT LAYER'S READS, split out of `queries.ts` on the 150-line gate. */

/** WHO you are, which `/api/me/permissions` deliberately does not answer — that one says what you may DO. */
export const meProfile: ReadDescriptor<MeProfileResponse> = {
  path: "/api/me/profile",
  key: ["me", "profile"],
  schema: MeProfileResponse,
};

/** The roster, and `privileged_without_mfa` beside it. */
export const people: ReadDescriptor<PeopleResponse> = {
  path: "/api/people",
  key: ["people"],
  schema: PeopleResponse,
};

/** Server-side, decision C16 — the reason nothing in this app touches storage. */
export const preferences: ReadDescriptor<PreferencesResponse> = {
  path: "/api/me/preferences",
  key: ["me", "preferences"],
  schema: PreferencesResponse,
};

/** The rulebook. */
export const rules: ReadDescriptor<{ rules: Rule[] }> = {
  path: "/api/rules",
  key: ["rules"],
  schema: RulesResponse,
};

/** Append-only, and READ-ONLY BY CONSTRUCTION (`endpoints.ts:575`). */
export const audit: ReadDescriptor<AuditResponse> = {
  path: "/api/audit",
  key: ["audit"],
  schema: AuditResponse,
};
