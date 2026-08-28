import {
  AuditResponse,
  RulesResponse,
  MeProfileResponse,
  PeopleResponse,
  PreferencesResponse,
  type Rule,
} from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * THE ACCOUNT LAYER'S READS, split out of `queries.ts` on the 150-line gate.
 *
 * The seam is real rather than arithmetic: everything in `queries.ts` is the
 * pipeline — the queue, an order, its fields, its census — and everything here
 * is the shop's administration. The two are read by different screens, at
 * different times, by different roles, and nothing on either side names a path
 * on the other.
 *
 * The same rule governs both files: they carry the DESCRIPTION of a read and
 * never perform one, because `check-rules.mjs` keeps `@tanstack/react-query`
 * out of `shared/`. `app/useRead.ts` is the three lines that fetch.
 */

/**
 * WHO you are, which `/api/me/permissions` deliberately does not answer — that
 * one says what you may DO. `intake.ts:352-356`: "Identity and authorisation
 * are different questions and conflating them is how a screen ends up trusting
 * a name it got from a permissions payload."
 */
export const meProfile: ReadDescriptor<MeProfileResponse> = {
  path: "/api/me/profile",
  key: ["me", "profile"],
  schema: MeProfileResponse,
};

/**
 * The roster, and `privileged_without_mfa` beside it. That figure is the
 * SERVER'S and is never a filter over `people` (`intake.ts:330-334`): the
 * roster is role-scoped, the gate is not, and "a compliance count that falls as
 * your permissions narrow is a gate that looks satisfied when it is not."
 */
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

/**
 * The rulebook. A reference document, not a work queue — see `RulesPanel`.
 *
 * Typed structurally rather than as `RulesResponse`, because `endpoints.ts:651`
 * exports the SCHEMA under that name and no inferred type beside it, unlike
 * every neighbouring shape. `packages/contract` is frozen, so the type is spelt
 * from the `Rule` the contract does export rather than by adding an alias to a
 * package this app does not get to edit.
 */
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
