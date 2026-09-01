# Rules and authz, validated 2026-09-01

Eleventh companion to `LEAD-MEASUREMENTS-2026-09-01.md`. A second pass over the
two areas whose findings were swarm-produced rather than lead-verified. The
invariant half is in `INVARIANT-CLASSIFICATION-2026-09-01.md`; this covers the
**rulebook (R1–R24)** and the **authz door table**, both of which I had
reported without checking.

---

## 1. The authoritative rulebook text does not exist

`AGENTS.md` and `HANDOFF §3` both cite **`docs/rulings_2026-07.md`** as holding
the full text of the 24 rules. **That file is not in the repository and not on
this host.**

This is not a new discovery — `GATE_0_RECOVERY.md:462` already records it:

> `docs/rulings_2026-07.md` — **MISSING**. Not in either archive; not found in
> any searched root. R13–R24 full text exists only in summary form in
> `CONTEXT §9` and `PRD §10`.

and assesses it at `:469` as *"a documentation gap to close, not a build
blocker"*, because the summaries are detailed enough to implement against.

**I agree with that assessment, with one qualification.** `PRD §10` does carry
all twelve senior rulings at implementable detail — R13's suppression
categories, R15's verified-release condition, R16's seven render triggers,
R18's balance-without-citation hard fail, R24's structural segmentation
boundary. A plan can be written against it.

But the qualification matters for Plan 08: **`docs/spec.md` is also absent from
this host.** `GATE_0_RECOVERY.md:461` marks it RECOVERED *inside the archive* —
and the archive is on another machine (`LEAD-MEASUREMENTS §2`). `CONTEXT §9`
sources the provenance-tag vocabulary from `spec.md`, so the tag definitions
survive in summary while their source does not.

So the rule *provenance tags* — `RULED` / `DERIVED` / `OPEN` / `CONFLICT`, where
**`OPEN` means do not build past it** — are known by definition but **not
per-rule**. Nothing on this host says which of the 24 carries which tag. A plan
that must not build past an `OPEN` rule cannot currently tell which rules those
are. That belongs with G2.

## 2. Zero of the 24 rules are enforced anywhere

Searched `services/` and `libs/` for R13–R24 references. Every hit is
**fixture data or documentation**, never logic:

- `db/rules.py:151-157` — a comment explaining that `R13 v1` and `R13 v2` as
  two rows is the shape the schema is built for.
- `tests/test_rule_repository.py:124-125`, `test_forced_rls_and_grants.py:812`
  — `("R13", "live")`, `("R14", "pending")`, `("R15", "retired")` as seed rows.

The rules exist in the database as **rows to be served**, which is exactly what
Plan 02 built. None of them **does** anything.

I also checked the converse, because it would be a design defect: **the
frontend enforces no rule either.** No hit in `apps/web/src` outside
`rule_refs` display and rule-pill rendering. That is correct — the backend is
upstream and the rules live in the rulebook, not the pixels — and it means the
24 rules are unimplemented rather than misplaced.

## 3. The authz door table is nearly half dead

Counted from `packages/contract/src/authz.ts`:

| measure | count |
|---|---|
| total actions | **47** |
| screen doors | **19** |
| screen doors for screens deleted in `7f04340` | **9** |
| mutation actions (non-screen) | **28** |

The nine dead doors are `/queue`, `/bench`, `/dashboard`, `/complaints`,
`/reconciliation`, `/seed-correction`, `/blind-status`, `/golden`,
`/leaderboard` — each still declared with its role list. **Ten of nineteen
doors are live.**

Six *mutation* actions also belong only to deleted screens:
`complaint.record`, `complaint.resolve`, `golden.confirm`, `golden.correct`,
`golden.demote`, `reconciliation.rule`.

Roles by breadth: `admin` 43 mentions, `senior` 17, `ops` 17, `engineer` 15,
`reviewer` 8, `typist` 3. The typist's narrowness is deliberate — INVARIANT 46,
*"the capture seat has no rail; structural blindness stays whole."*

**Why this matters for Plan 03.** INVARIANT 41 is *"one permission table gates
UI affordances and server mutations alike — they cannot drift."* The server
will evaluate against this table. If it implements all 47 actions, it grants
roles access to six mutations whose screens do not exist; if it implements only
the live ones, the table and the server have already drifted, which is the
thing 41 forbids.

That is a consequence of G1's boundary question, not a separate decision — but
it means **G1 blocks Plan 03 as well as Plan 06**, which the master plan did
not say.

## 4. What I verified about WorkOS

Plan 03's gate 1 states *"`workos` is pinned nowhere in the tree today."*
**Confirmed:** no match in any `pyproject.toml`, any `uv.lock`, or
`pnpm-lock.yaml`. The dependency does not exist, so nothing about the
integration has been exercised.

ADR-0001's correction of `ARCHITECTURE_REVIEW.md:189` also holds up on
reading: sealed sessions and JWKS verification are not competing
implementations, because `Session.authenticate()` **is** JWKS verification plus
encrypted custody of the refresh token. I did not run this — the package is not
installed — so I am relying on the ADR's own research note, which cites the
wheel version it was verified against (`workos==10.1.1`).

## 5. What I did not check

- I did not verify each of R1–R12. They are one-line summaries in both
  `CONTEXT §9` and `PRD §10` with no fuller text on this host, so there is
  nothing deeper to check them against.
- I did not confirm the per-rule provenance tags, because the file that
  carries them is absent. That is the finding in §1, not a gap in the check.
- I did not exercise WorkOS at all.
