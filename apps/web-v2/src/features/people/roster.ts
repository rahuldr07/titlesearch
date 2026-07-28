/**
 * The roster the design draws, as obviously-synthetic constants.
 *
 * CONTRACT GAP: there is no people endpoint. `GET /api/me/permissions` answers
 * for the CALLER only — by design it names no other account — so a roster of
 * everyone cannot be assembled from anything the contract currently ships.
 * Neither can invitation state, MFA enrolment, or suspension.
 *
 * Every flag below is stored, never computed. `gated` is not derived from
 * `privileged && !mfa` here even though the design's own mock does exactly
 * that: the server owns which combinations trip a gate, and a client that
 * re-derives the predicate is a second rulebook waiting to disagree with the
 * first.
 */

/** Account lifecycle as the design draws it — not a pipeline state. */
export type AccountStatus = "Active" | "Suspended" | "Invited";

/** What the MFA column says, verbatim. Three strings, no fourth. */
export type MfaState = "enrolled" | "pending" | "absent";

export interface Person {
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly status: AccountStatus;
  readonly mfa: MfaState;
  /** The account holds privileged actions — admin, engineer, senior, ops. */
  readonly privileged: boolean;
  /** The server says this account trips the MFA gate. Stored, not derived. */
  readonly gated: boolean;
}

export const DEMO_PEOPLE: readonly Person[] = [
  {
    name: "DEMO — A. Sample",
    email: "a.sample@demo.invalid",
    role: "Senior examiner",
    status: "Active",
    mfa: "enrolled",
    privileged: true,
    gated: false,
  },
  {
    name: "DEMO — B. Placeholder",
    email: "b.placeholder@demo.invalid",
    role: "Reviewer",
    status: "Active",
    mfa: "enrolled",
    privileged: false,
    gated: false,
  },
  {
    name: "DEMO — C. Specimen",
    email: "c.specimen@demo.invalid",
    role: "Engineer",
    status: "Active",
    mfa: "absent",
    privileged: true,
    gated: true,
  },
  {
    name: "DEMO — D. Fixture",
    email: "d.fixture@demo.invalid",
    role: "Admin",
    status: "Active",
    mfa: "enrolled",
    privileged: true,
    gated: false,
  },
  {
    name: "DEMO — E. Stub",
    email: "e.stub@demo.invalid",
    role: "Reviewer",
    status: "Suspended",
    mfa: "enrolled",
    privileged: false,
    gated: false,
  },
  {
    name: "f.example@demo.invalid",
    email: "invitation sent",
    role: "Reviewer",
    status: "Invited",
    mfa: "pending",
    privileged: false,
    gated: false,
  },
];

/**
 * The banner's number, as a SERVER FIGURE.
 *
 * Deliberately not `DEMO_PEOPLE.filter(...).length`. Counting the visible rows
 * would quietly redefine the number as "gated accounts you can see", and this
 * roster is already role-scoped — a count that shrinks when your permissions do
 * is the kind of number that makes a production gate look satisfied.
 *
 * CONTRACT GAP: no endpoint reports it.
 */
export const DEMO_PRIVILEGED_WITHOUT_MFA = 1;

/** The MFA column's text, per state. Presentation only. */
export const MFA_LABEL: Record<MfaState, string> = {
  enrolled: "MFA ✓",
  pending: "MFA pending",
  absent: "MFA ✗",
};
