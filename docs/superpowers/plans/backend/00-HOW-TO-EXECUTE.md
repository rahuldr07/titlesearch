# How to execute a backend plan

> **You are the LEAD.** You do not write the code. You dispatch a subagent per
> task, verify its work yourself, and refuse it when the evidence is missing.
> This file is the protocol. Every numbered plan in this directory assumes it.

Read this once, then read your plan. If the two conflict, **this file wins on
process** and the plan wins on content.

---

## 1. The rule this whole protocol exists for

**A subagent's report that it is done is not evidence that it is done.**

This is not cynicism, it is the measured behaviour of this repo's own history:

- Implementation agents reported "all gates green" when `knip` was red and the
  e2e suite had never been run once.
- Four separate defects — a 3,276px page, seventeen rows collapsed to 10px
  rules, a document facsimile at 11% of its pane, an accent colour painted on
  nothing — **passed every test in a 594-test suite.**
- A settings validator agreed with its own bug for weeks, because the only value
  ever exercised was the one that should have failed.

So: **you run the gate. Not the subagent.** A task is done when *you* have seen
the commands pass in your own tool output, and seen the injection fail.

### 1.1 Why every proof needs a positive control — measured, 2026-08-05

Plan 01's isolation suite was run against a real `postgres:18.4` with the tenant
mechanism **torn out** — the `after_begin` listener removed entirely, so no
tenant is ever established.

Six of nine assertions failed, as they should. **Three passed.** They were:

```
test_3   a session with no tenant reads zero rows rather than raising
test_5   a raw core connection establishes no tenant and sees nothing
test_6   the app role cannot become the owner
```

Look at what those three have in common: **every one of them is satisfied by a
database that denies everybody everything.** They are pure-denial assertions. A
system with no tenant scoping at all — and a system with perfect tenant scoping —
both pass all three.

Without the positive controls (`1b`, each tenant sees its *own* rows across every
table; `2b`, an own-tenant write *succeeds*), ripping out the entire tenant
mechanism would have produced what looked like a clean run.

**So: for every proof you write, ask what a broken-in-the-obvious-way system
would score on it.** If the answer is "full marks", you have written a denial
test and called it an isolation test. The suite must be able to tell *isolated*
from *broken*, and only a control that FAILS when the mechanism is removed can do
that.

It took three rounds to get right on Plan 01: `1b` covered only `orders` until a
review caught it, `1a` could not observe a pool checkout at all until it was
rewritten to read the residual off a raw `engine.connect()`, and `2b` did not
exist until the day the suite was finished.

### 1.2 A small trap that will waste your time

`services/core-api/pyproject.toml` sets `addopts = "-q"`. **pytest's verbosity is
a counter**, so a `-v` on the command line is cancelled by that `-q` and you get
quiet output while believing you asked for verbose. Use `-vv`.

---

## 2. The loop, per task

```
  1. DISPATCH   one subagent, one task, with the task's full text
  2. RECEIVE    its report — treat as a claim, not a result
  3. VERIFY     run the gate yourself
  4. INJECT     apply the task's ANTI-VACUITY step; confirm the named check FAILS
  5. RESTORE    undo the injection; confirm green again
  6. REVIEW     dispatch an independent reviewer (§4)
  7. COMMIT     only now, with the evidence in the message (§6)
```

Never batch. Never run task N+1 while N is unverified — later tasks consume
earlier interfaces, and a wrong interface propagates silently.

### Dispatching

Give the subagent: the task's complete text, this file's §3 (its obligations),
and the repo path. Do **not** give it the whole plan — a subagent that can see
later tasks will build for them and widen its own scope.

Tell it explicitly: *"Report what you actually ran and what it printed. If you
could not run something, say so. A truthful 'blocked' is worth more than a
plausible 'done', and I will verify either way."*

---

## 3. What every implementing subagent must be told

Paste this into every dispatch:

> - Work only within the files this task names. If you need to change a file it
>   does not name, stop and report why.
> - Read the neighbouring code before writing. Match its style, its comment
>   density, its idiom. This repo comments the *why*, not the *what*.
> - No `Any`, no `# type: ignore`, no `cast()` without a `rules-allow:` comment
>   carrying a reason of at least 12 characters.
> - Never weaken or delete an existing test to make yours pass. If an existing
>   test now fails, that is a finding — report it, do not fix it silently.
> - Never mark a test `skip` or `xfail` to get green. If you cannot run
>   something, say so.
> - Do not invent credentials, connection strings, or fixture data that the task
>   did not specify. Ask.
> - When you finish, report: the exact commands you ran, their output, and
>   anything you were unsure about. Unsurfaced uncertainty is the expensive kind.

---

## 4. The review stage

Dispatch a **separate** subagent. Not the implementer, and not given the
implementer's report — a reviewer shown the answer reviews the answer.

Its brief, verbatim:

> Review this diff against the task it claims to implement. **Your default
> verdict is NOT DONE.** Find what is missing, wrong, or unproven. For each
> finding: cite `file:line`, state concretely what breaks and under what input,
> and say what the code should do instead. Do not report style preferences. If
> the work is genuinely complete, say so in one line — but look for at least
> these first:
>
> - a test that asserts a constant rather than querying the real thing
> - a test that would pass if the implementation were deleted
> - an error path with no test
> - a `try/except` that swallows
> - anything that runs at import time rather than call time
> - a shared helper re-implemented locally instead of imported

**Escalate on disagreement, do not average.** If the reviewer and implementer
conflict, you decide by running the thing — not by splitting the difference.

---

## 5. When you are blocked

Plans mark hard stops as **🔴 HUMAN GATE**. At one of those you **stop and ask
the user**. You do not:

- invent a password, a DSN, or a credential;
- substitute an in-memory fake for a database the plan requires;
- mark the test `skip` and move on;
- pick one side of a ruling the plan says is the owner's.

A plan that stalls at a human gate is working correctly. A plan that glides past
one has produced work nobody can trust.

**If the plan itself is wrong or incomplete — say so and stop.** These documents
have been attacked twice and still had defects. You finding a hole is the system
working, not you failing.

---

## 6. Evidence, and what goes in the commit

Each task commits separately. The message states what was proven, not what was
attempted:

```
<what the task achieved, in one line>

<why, and any decision you made that the plan left open>

Gate: <the exact commands, and their results>
Injection: <what you broke, and which assertion failed as a result>
```

**"Tests pass" is not evidence. "Tests fail without the fix" is.** If you did not
run the injection, the task is not done, however green the suite is.

---

## 7. Working with the database

Several plans need a real PostgreSQL. Two are known to exist:

**Ruled 2026-08-05: use an ephemeral `postgres:18.4` container, not a host
cluster.** `TP_TEST_DATABASE_URL` overrides it for anyone aiming at a real one.

This table described the Windows box and was **measured to be wrong for the WSL
environment the work actually runs in**. Both rows are kept because a stale
instruction that quietly inverts is worse than no instruction:

| where | port | version | measured 2026-08-05 |
|---|---|---|---|
| Windows dev box | 5433 | 18.4 | **unreachable from WSL** (NAT + firewall) |
| Windows dev box | 5432 | 16.14 | unreachable from WSL |
| WSL local | **5432** | **18.4** | online — the *default* port is the *right* major here |
| WSL local | 5433 | — | nothing listening |
| container | — | any | `postgres:18.4` and `postgres:16` (=16.14) both run |

Pointing at the default port silently tests the wrong major **on the Windows
box, and the right one in WSL** — which is worse, because a plan that says
"avoid 5432" sends you to a port with nothing on it. Every plan that touches the
database asserts `server_version` for exactly this reason, and no plan should
name a port without saying which machine it means.

**Superusers bypass RLS unconditionally** — `FORCE ROW LEVEL SECURITY` does not
stop them. Any isolation test that connects as a superuser passes while proving
nothing. This was demonstrated on this repo on 2026-08-05: as `postgres`, a
correctly forced table still returned every tenant's rows.

---

## 8. Reporting to the user

At the end of each task, report in plain language:

- what now works that did not before;
- the gate output, quoted, not summarised;
- which injection you ran and what failed;
- anything you decided that the plan left open;
- anything you could not verify — **say this even when everything else is green.**

Do not claim completion for work you did not verify yourself. If a subagent said
it worked and you did not check, the honest report is *"the subagent reports X;
I have not verified it."*

---

## 9. Plans in this directory

| plan | ships | status |
|---|---|---|
| [`01-postgres-correctness.md`](./01-postgres-correctness.md) | schema, roles, forced RLS, the tenant-isolation proof | **done and merged to `main`** — eight tasks, twenty commits (`160fcff`…the close-out). **Its handover is [`01-WHAT-HAPPENED.md`](./01-WHAT-HAPPENED.md)** |
| [`02-first-vertical-slice.md`](./02-first-vertical-slice.md) | `GET /api/rules` through the whole spine, plus the migration harness | **executed on `rahuldr07/backend-plan02`** (PR #7), six tasks, seven commits. **Its handover is [`02-WHAT-HAPPENED.md`](./02-WHAT-HAPPENED.md)** — read its §5 before writing any proof |
| [`03-identity.md`](./03-identity.md) | WorkOS sessions, server-evaluated authz | **DRAFT — four human gates open.** Not executable until they are ruled |
| 04 — order reads | context, queue, fields with provenance | not written |
| 05 — domain core + mutations | the five-state machine, seven refusals | not written |
| 06 — ingest + queue | R2 presigned upload, Procrastinate | not written |

Plans 02–06 are written after 01 lands, so each is informed by what actually
happened rather than what was predicted.

**Plan 02 is already written** ([`02-first-vertical-slice.md`](./02-first-vertical-slice.md)).
Read [`01-WHAT-HAPPENED.md`](./01-WHAT-HAPPENED.md) before *executing* it, and before
writing Plan 03.**
It is the "what actually happened" this paragraph promises, collected in one
place instead of nineteen commit messages: the exact interface Plans 02–06 call
and where it now lives, the measured constraints a later plan will hit, what the
structural gate refuses (including the rules added after Plan 01's Task 0
described them), and the items Plan 01 is handing over unfinished. Read it
alongside **"What eight tasks taught this plan about injections"** near the top
of Plan 01 — seven of its eight injections did not work as written, and the
taxonomy of *how* is the transferable part.

> **Correction, 2026-08-06.** Plan 01's status read **`ready`** until this line
> was written. It has been done since `9ddeefc`, and the row was never updated —
> the same class of defect as the plan's own stale acceptance criteria.
>
> **Second correction, later the same day.** The row was then updated to
> "seventeen execution commits (`160fcff`…`4b878c5`)", which went stale within
> the hour: `a9a973a` and `7e6165a` landed after it, and neither was an execution
> commit in the sense the row implied. The count is nineteen, and only eight of
> the nineteen built a task — the rest corrected the plan before a task could run
> or closed a review's findings after one had. A commit range written into prose
> ages the moment the next commit lands; if you update this row, update it to the
> branch tip.

**Canonical context:** [`docs/backend/BUILD-PLAN.md`](../../../backend/BUILD-PLAN.md)
— architecture, pinned versions and the traps behind each. Read it before Task 0.
