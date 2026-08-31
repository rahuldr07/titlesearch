import {
  AuditResponse,
  RbacMatrixResponse,
  RulesResponse,
  MeProfileResponse,
  PeopleResponse,
  PreferencesResponse,
  type Rule,
} from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** The account layer's read descriptors. */

/** Who you are — `/api/me/permissions` deliberately answers only what you may do. */
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

/** Server-side — the reason nothing in this app touches browser storage. */
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

/** Append-only, and read-only by construction. */
export const audit: ReadDescriptor<AuditResponse> = {
  path: "/api/audit",
  key: ["audit"],
  schema: AuditResponse,
};

/**
 * The Access pane's full RBAC matrix, and the role vocabulary the People
 * pane's picker offers. A settings document about the shop; the enforceable
 * projection stays `/api/me/permissions` and neither derives from the other
 * in the browser.
 */
export const rbacMatrix: ReadDescriptor<RbacMatrixResponse> = {
  path: "/api/rbac",
  key: ["rbac"],
  schema: RbacMatrixResponse,
};
