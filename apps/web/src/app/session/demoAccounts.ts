import type { Role } from "@titlepipe/contract";
import type { DemoAccount } from "./signedIn";

/**
 * THE FOUR DEMO ACCOUNTS — the design's screen 1 "demo — continue as" rows.
 *
 * DEV-ONLY, and the same cutover as `shared/session.ts`'s `x-mock-role`:
 * `ANALYSIS-screens.md` §1 records it as "Design's 4-account switcher is
 * mock-auth only; Clerk at P1."
 *
 * ══ THE ROLES ARE THE CONTRACT'S, NOT THE DESIGN'S ═════════════════════════
 *
 * `ANALYSIS-screens.md` §3 requires three renames, and they are applied here
 * rather than at the render site so no screen can print a job title the
 * contract does not hold:
 *
 *   - "Typist (Reviewer)" is ONE seat in the design and TWO ROLES in the
 *     contract. `typist` is blind-capture and structurally CANNOT review —
 *     `screen.review.enter` is SIGHTED only, which excludes typist
 *     (authz.ts:66, authz.ts:57). Split, and both are listed: signing in as
 *     the typist is the only way to see that the rail draws a different world.
 *   - "QC Reviewer" is `senior` (authz.ts:33).
 *   - "Admin · Licensed Examiner #GA-8841" is `admin`. Licence numbers are not
 *     in the contract, so the number is dropped rather than invented.
 *
 * `seat` carries the design's own words for what the person does, beside the
 * contract role, so neither vocabulary is lost. `role` is what reaches the
 * wire.
 *
 * The names are the prototype's (D. Okafor rules, R. Menon countersigns as QC).
 * The addresses are `example.com` — RFC 2606 reserves it precisely so a demo
 * fixture cannot name a real mailbox.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "okafor",
    name: "D. Okafor",
    email: "d.okafor@example.com",
    role: "reviewer",
    seat: "Examiner",
    initials: "DO",
  },
  {
    id: "menon",
    name: "R. Menon",
    email: "r.menon@example.com",
    role: "senior",
    seat: "QC",
    initials: "RM",
  },
  {
    id: "abara",
    name: "T. Abara",
    email: "t.abara@example.com",
    role: "typist",
    seat: "Blind capture",
    initials: "TA",
  },
  {
    id: "vance",
    name: "L. Vance",
    email: "l.vance@example.com",
    role: "admin",
    seat: "Administrator",
    initials: "LV",
  },
];

/**
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`:
 * the reference's profile block draws a per-role hint line (`roleHint` in
 * reference-app.html), so ours does. The four lines the reference authors are
 * taken verbatim for the roles that exist in both rosters (its "Typist
 * (Reviewer)" seat maps to our `reviewer`, its "QC Reviewer" to `senior`);
 * the two roles the reference roster does not carry get lines written in the
 * same register, from what the permission table (`authz.ts`) actually grants.
 */
export const ROLE_HINTS: Readonly<Record<Role, string>> = {
  admin: "Full access · rules, templates, people, release",
  reviewer: "Rulings only · no countersign · library read-only",
  senior: "Countersigns T1 · rules on escalated queries",
  engineer: "Pipeline & telemetry · no order mutations",
  typist: "Blind capture · keys the sheet · sees no engine output",
  ops: "Intake & delivery · accepts packages, executes release",
};

/**
 * The reference roster's licence strings ("#GA-8841"), by demo account id —
 * RULING-2026-08-29 draws them on the sign-in rows, attached to the two
 * people the reference licenses (D. Okafor and R. Menon). Nobody else holds
 * one, so nobody else gets one invented.
 */
export const ACCOUNT_LICENSES: Readonly<Partial<Record<string, string>>> = {
  okafor: "#GA-8841",
  menon: "#GA-9104",
};
