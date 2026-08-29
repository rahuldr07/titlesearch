# CONFLICT — intake draws three writable fields the reference reads from the package

Status: **OPEN — owner's call.** Raised 2026-08-29, after a side-by-side of the
built `/ingest` against the reference app's Intake screen showed the two
disagreeing about who supplies jurisdiction.

## What the reference draws

The reference's Order Configuration column (`reference-app.html`, Intake) is:
Client select · Product select · Client Order # input · then a paired
**read-only** row — Page Count `—` and Jurisdiction `— read from clerk stamp` —
under an amber note:

> **Rulebook binds after quarantine.** Jurisdiction is read from the recorded
> clerk stamp once the package passes optical quarantine, so the state overlay
> can never be hand-picked wrong.

No writable jurisdiction, state, or county anywhere. The package is the source.

## What the contract requires

`CreateOrderRequest` (`packages/contract/src/endpoints.ts:39-45`) has five
members — `client_id`, `external_ref`, `jurisdiction`, `state`, `county` — and
the mock refuses a create that omits any of them, naming the missing fields
(`IngestRejection`). So the caller MUST hand-supply the three values the
reference says only the clerk stamp may decide. `OrderFields.tsx` records the
collision in place and draws the writable fields, because the contract is
upstream of the pixels.

## Why this is a real question, not a fidelity nit

The reference's version is the SAFER one under the repo's own principle 6
(never emit a value you can't cite): a hand-typed jurisdiction is exactly the
"state overlay hand-picked wrong" failure the amber note names, and the clerk
stamp is a citable source the quarantine surface (`QuarantineResponse.optical`)
already reads. The built version is faithful to the ratified wire, not to the
drawn intent.

**Resolving it needs a contract change nobody has ruled:** dropping (or making
server-resolved) three required members of a ratified request shape.
RULING-2026-08-28 §1 allows ADDING members, not changing what existing ones
mean, so this sits outside what a build session may do.

**If the ruling is "the reference is right":** `jurisdiction`/`state`/`county`
move off `CreateOrderRequest`; the server resolves them from the clerk stamp
after optical quarantine and serves them on the order; intake draws the
reference's read-only paired row; `IngestRejection` stops naming them.

**If the ruling is "the wire is right":** the reference's read-only row and the
clerk-stamp sentence of its amber note are corrected in the next design pass,
and this file closes.

## Smaller divergences seen in the same side-by-side, each already decided

- **One sign act vs two.** The reference's footer is one disabled "Sign for
  Package & Begin Dual-Engine Extraction →". INVARIANT 47 ("acceptance is
  explicit — an upload alone never queues an order") splits it: upload, then a
  separate signed acceptance. The invariant wins; recorded in
  `IngestScreen.tsx` and pinned by `e2e/invariants/ingest.spec.ts`.
- **The examiner-signature line** sits on the sign act (`AcceptCard`), not the
  upload footer — printing it beside an upload button would claim the upload is
  signed.
- **Dropzone constants.** "single PDF bundle (20–150 pages) · 300 DPI
  recommended" is refused: neither figure has a citable source, and the shop's
  packages run 36–181 pages (`docs/CONTEXT.md`). The dropzone states what is
  true instead.
- **Client as radio cards, not a select** — the house choice-card pattern;
  presentational only. The reference select's "(14 sign-offs)" count is a
  client-side tally rule 11 refuses.
- **Quarantine checklist placement.** The reference draws the gateway on the
  intake form; the app reads it on the accept stage, because the read is
  order-scoped and no order exists until the upload returns one
  (`IngestForm.tsx`, `QuarantinePanel.tsx`).
