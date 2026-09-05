import type { Role } from "./authz.js";

/**
 * The mock-phase seat roster — one display identity per role.
 *
 * This exists because a signature the caller types is not a signature. The
 * golden ledger, the audit ledger and the countersign record all name WHO
 * acted, and that name must be a PRODUCT of the credential rather than a
 * field beside it. `x-mock-role` is the only credential the mock phase has:
 * a closed enum the gate already refuses garbage in. So the identity is a
 * function of it, resolved server-side in `packages/mocks/src/guard.ts`, and
 * no name reaches the mock from the wire at all.
 *
 * Being readable by the client costs nothing. Unforgeability here comes from
 * the server never ACCEPTING a name, not from the name being secret — a
 * caller who knows every entry in this table still cannot pick which one
 * gets stamped without holding the matching role.
 *
 * One name per role is the honest ceiling of what a role-only credential can
 * distinguish. Two people in one seat are one identity here, and that limit
 * is the reason the table is temporary: at the ADR-0001 cutover the signer
 * comes from the session claim, per-person, and this file is deleted whole
 * along with `x-mock-role`.
 *
 * `apps/web`'s `DEMO_ACCOUNTS` draws its names from here so the seat the
 * sign-in screen shows is the seat the ledger records; `seat-roster.test.ts`
 * fails if the two ever disagree.
 */
export const SEAT_IDENTITIES: Readonly<Record<Role, string>> = {
  reviewer: "D. Okafor",
  senior: "R. Menon",
  ops: "K. Ibarra",
  engineer: "S. Duarte",
  typist: "T. Abara",
  admin: "L. Vance",
};
