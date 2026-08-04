/**
 * The rulebook's authorisation refusals, verbatim, in one module.
 *
 * REFUSALS NEED REASONS, AND THE REASON IS A FIXED STRING — not a sentence each
 * panel spells for itself. Confirming and retiring are the two acts that change
 * what extraction does, and the export refuses both with the SAME shape of
 * sentence on purpose: "restricted to engineer and admin — because it changes
 * extraction". Spelled by hand in two files they had already drifted; the
 * retire copy carried a trailing "does" the export does not have
 * (`TitlePipe.dc.html:3523`), and a reader who meets both learns that being
 * refused a retire and being refused a confirm are different kinds of refusal.
 *
 * NOT `designFixture.ts`. That module holds figures the wire cannot supply and
 * every one of them ships a "not wired" caption. These are the opposite: real,
 * final product copy that the authz table backs today. Filing them together
 * would put a caption on a refusal, which reads as "this refusal is illustrative".
 */

/** `ConfirmBlock` — the role gate on making a rule live. */
export const CONFIRM_RESTRICTED =
  "Confirmation is restricted to engineer and admin. A senior rules on the domain question; someone else enables it.";

/** `RetireBlock` — the role gate on taking a live rule out of force. */
export const RETIRE_RESTRICTED =
  "Retiring is restricted to engineer and admin — it changes extraction as much as confirming.";

/** `ResolveCard` — the role gate on withdrawing an unresolved rule. */
export const WITHDRAW_RESTRICTED =
  "Withdrawing is restricted to engineer and admin — a senior records the ruling instead.";
