import { SEAT_IDENTITIES, type Role } from "@titlepipe/contract";
import type { DemoAccount } from "./signedIn";

/**
 * The four demo accounts — the sign-in screen's "demo — continue as" rows.
 * Dev-only, same cutover as `shared/session.ts`'s `x-mock-role`.
 * The roles are the contract's, not the design's job titles, applied here
 * rather than at the render site so no screen can print a title the contract
 * does not hold. `seat` carries the design's own words beside the contract
 * role; `role` is what reaches the wire. Addresses are `example.com` —
 * RFC 2606 reserves it so a demo fixture cannot name a real mailbox.
 *
 * The NAMES are read from the contract's `SEAT_IDENTITIES` rather than typed
 * here, because that table is what the mock stamps on a golden correction, an
 * audit row and a countersign. Typing them twice is how a screen comes to say
 * you signed in as one person while the permanent record names another.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "okafor",
    name: SEAT_IDENTITIES.reviewer,
    email: "d.okafor@example.com",
    role: "reviewer",
    seat: "Examiner",
    initials: "DO",
  },
  {
    id: "menon",
    name: SEAT_IDENTITIES.senior,
    email: "r.menon@example.com",
    role: "senior",
    seat: "QC",
    initials: "RM",
  },
  {
    id: "abara",
    name: SEAT_IDENTITIES.typist,
    email: "t.abara@example.com",
    role: "typist",
    seat: "Blind capture",
    initials: "TA",
  },
  {
    id: "vance",
    name: SEAT_IDENTITIES.admin,
    email: "l.vance@example.com",
    role: "admin",
    seat: "Administrator",
    initials: "LV",
  },
];

/**
 * Per-role hint lines for the profile block. Each line states only what the
 * permission table actually grants that role.
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
 * Licence strings by demo account id, drawn on the sign-in rows. Only these
 * two hold one, so nobody else gets one invented.
 */
export const ACCOUNT_LICENSES: Readonly<Partial<Record<string, string>>> = {
  okafor: "#GA-8841",
  menon: "#GA-9104",
};
