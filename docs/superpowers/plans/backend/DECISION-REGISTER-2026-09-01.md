# Decision register, 2026-09-01

Sixth companion to `LEAD-MEASUREMENTS-2026-09-01.md`. What blocks backend work,
what does not, and which supposed blockers are already ruled.

**The first thing this file exists to correct: I said in an earlier session
that the NA enum was unruled and had to be decided before writing to `fields`.
That was wrong.** It was ruled by the owner on 2026-07-26. `HANDOFF §2a` is
simply out of date, and I repeated it without checking the frontend's own
decision ledger. Recorded here so nobody else re-opens a closed question.

---

## Already ruled — do not re-litigate

### D3 — the NA taxonomy. Ruled 2026-07-26.

`docs/frontend/decisions.md:124`. `NaReason` = `NOT_PRESENT` · `NOT_FOUND` ·
`NOT_STATED` · `PRESENT_UNREADABLE`. Four states.

The ruling was made against **five** disagreeing vocabularies
(`open-rulings.md:11-25`), and three of them — the design export, the rebuild
brief, and `contract` after widening — converged on the same four. So
migration `0001`'s four-label enum is **correct and consistent with the
owner's ruling**, not the uncited invention `HANDOFF §2a` calls it.

Two consequences for the backend, both already stated in the ruling:

- `pending` is deliberately **not** an enum member. "We have not looked yet" is
  a statement about the pipeline, not the document, and conflating them is
  named as *"the ghost-chasing bug one level up"*.
- Renaming `NOT_PRESENT` → `NOT_USED_IN_JURISDICTION` to match the Python
  models was **explicitly deferred to the Gate 6 port**, on the grounds that it
  would churn three screens for no behavioural gain.

That second point is the live item: the reconciliation is *scheduled*, and it
lands in the port that cannot start while the archive is on another machine
(`LEAD-MEASUREMENTS §2`).

### D1 — escalation resolution still requires a rule. Unchanged.

`decisions.md:7`, resolving Q11. PENDING rules cannot affect the pipeline until
engineer-confirmed. Already a hard rule in `AGENTS.md`.

## Open, and genuinely blocking

### Q12 — is the queue a single card or a workspace? **This is the one.**

`open-rulings.md:139`. INVARIANT 22 is *"the queue is a single server-chosen
next order — no list, no browsing, no cherry-picking."* The reference app
replaced it with All Orders, a browse table — *"the opposite affordance"*.

`CONFLICT-deleted-queue-and-rail-controls.md` states it precisely: replacing the
queue with All Orders *"does not relocate that invariant; it removes the surface
that enforced it"*, and the repo's anti-pattern list names *"no queue
cherry-picking"* explicitly. The 26 `/queue` e2e failures I measured are
**this conflict, deliberately left failing** — *"Deleting them would erase the
record of a decision nobody made."*

The ask on the owner is narrow: confirm the anti-cherry-pick rule now means
*"you cannot choose your next order"* rather than *"you cannot see other
orders."*

**Backend consequence:** `GET /api/queue/next` is live in the frontend and
mocked. Whether the server also owns a *browsable, role-scoped* order list with
a Reopen path depends entirely on this answer. It changes what the queue
endpoint family is, not merely whether one route exists.

### Q16 — is MFA on privileged accounts a server gate or a banner?

`open-rulings.md:163`. The People screen renders *"N privileged account without
MFA — this is a production gate."* Compliance §14 requires MFA. Enforcement
blocks the account; advisory shows a banner. **The word "gate" implies
enforcement**, and the server is the only place it can be enforced. Blocks the
identity plan's scope.

### Q17 — does `GET/PATCH /api/me/preferences` land?

`open-rulings.md:166`. C16 decided user preferences belong on the server, but
the endpoint *"was never added to the contract or the mocks."* Until it exists,
`sidebar.spec`'s collapse-survives-reload assertion cannot be met without
browser storage, which §9.11 forbids and `check-rules` rejects.

This matches my measurement independently: `/api/me/preferences` appears in the
mocked-but-uncalled set (`ENDPOINT-RECONCILIATION §c`), documented at
`components/ui/sidebar.tsx:30` and asserted by
`e2e/invariants/sidebar.spec.ts:88`. A small endpoint that a frozen invariant
depends on.

### Plan 03's four gates — identity

`03-identity.md`, all four open, plan **not executable** until ruled: WorkOS
credentials; whether `/api/rules` requires a session; 401 vs 403 for an absent
session; acceptable identity-revocation latency.

Gate 3 is partly pre-decided by behaviour, if not by status code: the mock
already refuses an unidentified countersigner because *"an unidentified actor
cannot PROVE a second pair of eyes"* (`MSW-BEHAVIOUR-HARVEST §3`). Absent
identity is a refusal. Only the code is open.

### The prototype archive

`LEAD-MEASUREMENTS §2`. Not a question of judgement but of logistics, and it
gates the same Gate 6 port that D3's rename was deferred into. Compounded by an
unmade owner decision on whether the source may enter VCS at all, since its
tests embed real party names (`GATE_0_ARCHIVE_MANIFEST.md:17-19`).

## Open, not blocking the backend

Q2, Q3, Q4–Q10, Q13, Q14, Q15 are frontend or product-shape questions. Several
have de-facto answers in built screens. They should not hold up backend
sequencing, but Q5's intake sign-off checklist and Q9's client config
versioning both imply server-owned data that the schema does not yet have.

## The pattern worth naming

Two of the three things I flagged as blockers in this session's earlier passes
were **already documented by the team**: the NA taxonomy was ruled a month ago,
and the `/queue` e2e failures were written up as an open conflict on 2026-08-28
with the specs deliberately left failing as the record.

`docs/frontend/` holds `decisions.md`, `open-rulings.md` and eight
`CONFLICT-*.md` files. `docs/INDEX.md:81` names the rulings ledger
AUTHORITATIVE. Read those before declaring anything unruled — `HANDOFF.md` is
dated 2026-07-17 in its body and is not the latest word on frontend decisions,
despite `AGENTS.md` naming it as superseding.
