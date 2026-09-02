# Invariants → server obligations, classified 2026-09-01

Tenth companion to `LEAD-MEASUREMENTS-2026-09-01.md`. The swarm produced a
rules mapping; this is the lead's own classification of
`docs/INVARIANTS.md`'s 68 numbered invariants, done because the swarm's
version was reported at `plausible` confidence and never checked.

---

## The split

**42 of 68 invariants are server obligations. 26 are pure UI.** *(Corrected 2026-09-02 — INVARIANT 23, the no-pace-indicators rule, is a rendering prohibition and constrains no server behaviour. See `RULES-AND-AUTHZ-VALIDATION` addendum.)*

Every one of the 68 is classified; none double-counted. The 42 are: 1–22, 24, 25, 27,
28, 29, 33, 34, 35, 36, 37, 38, 40, 41, 44, 45, 47, 48, 55, 56, 67.

The concentration matters more than the count. **Sections 1–5 are entirely
server obligations** — "server owns all state" (1–6), "the two NA states"
(7–8), "refusals must speak" (9–15), "conflicts are answers" (16–19), "one act
files one record" (20–21). That is 21 consecutive invariants, none of which the
frontend can satisfy alone, and they are the first five sections of the
document because they are the load-bearing ones.

The 25 pure-UI invariants cluster in keyboard (49–54), frame and layout
(60–66) and the absent-not-disabled rules (42, 43, 46). Those are satisfied
today and need nothing from the backend.

## What is enforced today

**One.** Invariant 38 — *"a drafted rule lands PENDING and renders visibly
inert; it cannot affect the pipeline until an engineer confirms"* — has its
read half correctly implemented. `api/routers/rules.py:78-79` returns every
rule at every status, unfiltered, and states the reason:

> a `pending` rule is VISIBLE to everyone and only its EFFECT is gated

That is the right decomposition: visibility is the endpoint's job, inertness is
the pipeline's. The pipeline does not exist yet, so **the half of 38 that
actually gates anything is unbuilt**, and will be until Plan 07.

The other 42 server invariants have no server enforcing them.

## Two verified spot-checks

I checked the two invariants the rulebook treats as most dangerous, because a
mapping is only as good as its hardest case.

**R15 / suppression audit is correctly encoded.**
`endpoints.ts:678-680` makes `ExcludeFieldRequest.reason` a
`z.string().min(1)` — required, not optional — and the contract states why:

> The reason is required: a suppressed row is invisible on the delivered sheet,
> so the record of why is the only thing auditable later.

Note the asymmetry with the entity: `Field.excluded_reason` is
`.nullable().optional()` (`entities.ts:127`), because a field that was never
excluded has no reason. **Required on the write, optional on the read** is
correct here and should not be "fixed" into consistency.

**Invariant 40's ordering is provable only through one endpoint.**
`authz.spec.ts:17` drives `POST /api/engines/routing` and asserts `reviewer`
→ 403 while `engineer` → 422 **on the same invalid body**. That pair is the
whole proof: a test checking only 403 on a *valid* body passes with the
ordering reversed. Already recorded in `ENDPOINT-RECONCILIATION §b` as the
reason that endpoint must not be deleted.

## A correction this validation produced

`MSW-BEHAVIOUR-HARVEST §3` previously said the mock was *"safer than the
server"* because the countersign refuses an unidentified actor. **Retracted.**
Checking all the handlers rather than the one I had read:

| header | default when absent |
|---|---|
| `x-mock-role` | **`admin`** — `guard.ts:15`, `handlers.ts:587`, `workspace.ts:974` |
| `x-mock-actor` | refused at the countersign (`design.ts:720`); **`"L. Vance"`** in the audit log (`audit.ts:93`) |

The mock has the **same three-hole missing-header-grants-admin shape** Plan 03
attributes to the server, and its audit log attributes unattributed actions to
a named person. The countersign is the one handler that refuses, and only
because separation of duties is unprovable without two identities.

So Plan 03's gate 3 is genuinely open, not half-answered by behaviour.

## What I did not check

I classified all 68 but verified the *encoding* of only two in depth (R15 and
40) plus 38's implementation. The remaining 40 server invariants are
classified from their text, not traced to an enforcement point — there is no
enforcement point to trace them to, which is the finding, but it means the
classification is an obligation list rather than a gap analysis per invariant.
