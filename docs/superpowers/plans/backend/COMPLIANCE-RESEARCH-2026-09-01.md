# Compliance research, 2026-09-01

Eighth companion to `LEAD-MEASUREMENTS-2026-09-01.md`. What GLBA NPI and ALTA
Pillar 3 oblige the backend to do, and what is already built.

**Finding: compliance is the most-built part of the backend.** Redaction,
append-only audit, forced RLS and container hardening are real, tested and
subtle. This is the correct order for a system holding NPI, and it is worth
saying because `STATE-AUDIT`'s "85% plumbing" figure could be misread as waste.
It is not waste; a large part of it is the WISP.

---

## 1. The obligations, as written

`CONTEXT.md:492`: WISP documented · TLS everywhere · encryption at rest
(managed PG AES-256) **plus field-level envelope encryption** (DOB, bankruptcy)
· append-only audit log (doubles as SOC 2 evidence) · per-tenant retention
windows and secure deletion · least-privilege and MFA · vendor due-diligence
file for AI subprocessors (zero-retention API tiers) · **no NPI in URLs or
logs** · `packages/` never in VCS.

Data at risk: names, addresses, DOBs, bankruptcies (`CONTEXT.md:14`).

## 2. Built, and better than it needed to be

### Redaction — shared because a copy that drifts is a leak

`libs/domain/src/titlepipe_domain/redaction.py`, 455 lines, framework-free and
deliberately shared: *"a copy of it that drifts is a leak in whichever service
holds the stale copy, and that is not hypothetical — the first version of this
code lived in four copies and carried the same two defects in all four."*

The ordering finding is the valuable part and is exactly the kind of thing that
does not survive a rewrite: redaction runs **last, immediately before the
renderer, not first**. An earlier version ran it first, reasoning nothing
downstream could then see an unredacted value. Wrong, because processors
*after* it generate new fields — `format_exc_info` builds the traceback string
after redaction has run, so an exception carrying a connection string or a
party name reached stdout verbatim.

The invariant to preserve: **no processor runs after redaction except the
renderer.**

### The blind service's redaction is topological, not filtered

`services/blind-svc/.../telemetry/sensitivity.py` adds keys — `engine`,
`reading`, `confidence`, `model`, `extraction`, `auto_confirm`, `other_seat`,
`seat_a` — on a stated principle worth quoting into the plan:

> A blind typist must never see model output or the other seat's entry, and the
> guarantee is **topological**: none of this data is reachable from this
> process. So a field named for an engine [...] should not exist here *at all*,
> and its appearance in a log record is **evidence of a boundary failure**
> rather than an ordinary logging mistake.

Redaction keeps such a failure out of the log shipper;
`tests/test_blind_boundary.py` keeps it out of the code. That is the right
shape for blind-fifty: blindness enforced by process topology, with logging as
a tripwire rather than the control.

### Append-only audit — the trigger detail that matters

`0001_skeleton.py:304-381`. Two `BEFORE STATEMENT` triggers, and the split is
forced because a `TRUNCATE` trigger cannot be combined with the row-level ops.

The reasoning at line 54 is the one to carry forward: **`FOR EACH STATEMENT`,
not `FOR EACH ROW`.** A row trigger fires once per affected row, so it does not
fire at all when a statement affects none — and under `0002`'s RLS a
cross-tenant `UPDATE` matches exactly zero rows. `FOR EACH ROW` would be
**silent for the one case the trigger exists to refuse**, and the append-only
proof would pass vacuously.

That is the same class of error as `00-HOW-TO-EXECUTE §1.1`'s three
pure-denial assertions. Worth treating as a pattern: *a control that cannot
distinguish "refused" from "nothing happened" is not a control.*

### Forced RLS, and its measured limits

From `01-WHAT-HAPPENED.md`, and these are constraints not achievements:

- Forced RLS **hides tenant tables from the migration role** — hence the
  `SET LOCAL row_security = off` recipe.
- RLS defends a **forgotten `WHERE`**, not a **concatenated** one. It is not a
  SQL-injection control.
- **Superusers bypass RLS unconditionally.** So the roles design (five roles,
  all `NOSUPERUSER NOBYPASSRLS`, owner `NOLOGIN PASSWORD NULL`) is what makes
  RLS mean anything.

### CI enforcement

`backend.yml` runs a **client-data guard over the whole tree**, plus container
checks that the image does **not run as root** and carries no reload/debug flag
in its runtime command, plus SBOM and vulnerability scanning
(`STATE-AUDIT §CI`).

## 3. Not built, and each one is an obligation

| obligation | state |
|---|---|
| **Field-level envelope encryption** (DOB, bankruptcy) | nothing. Distinct from at-rest encryption; an application-layer control with key management |
| **Per-tenant retention windows + secure deletion** | nothing. No table, no policy, no job |
| **MFA** | nothing, and see Q16 — whether it is a *gate* or a banner is unruled (`DECISION-REGISTER`) |
| **Vendor due-diligence file for AI subprocessors** | nothing. Needed before any engine adapter calls a cloud model with NPI on the page |
| **No NPI in URLs** | redaction covers logs; URL discipline is unenforced by any gate |
| **`probes` table** | absent, and the anti-pattern rule says the table exists while the UI surface must not |
| **Delivery timestamping / digest** | `DeliveryStatus` has `digest_recorded`, and the mock's de-dup step references a digest on the books (`design.ts:408`). No server implementation |

The vendor due-diligence item deserves emphasis: it is a **precondition** on
the extraction plan, not a parallel chore. Sending a page containing a DOB to
Gemini or Claude is a subprocessor disclosure with a zero-retention-tier
requirement (`CONTEXT.md:492`). The pipeline cannot lawfully run on real data
before it exists.

## 4. A stale-doc correction

`CONTEXT.md:479` and `:155` name **Clerk** for auth. That is superseded:
**ADR-0001 records Clerk → WorkOS AuthKit** (`docs/adr/0001-core-api-fastapi.md:12,36`),
with sealed-session cookies and Postgres owning authorization. The ADR is the
later, signed decision; CONTEXT §15 was not updated.

`CONTEXT.md:101` also carries `users(... clerk_id)` in the authoritative data
model, which must become a WorkOS identifier at the port. Small, but it is the
kind of thing that gets copied into a migration verbatim.

Similarly `CONTEXT.md:478` names **Procrastinate** (Postgres-native) as the
queue, graduating to Celery/Redis only on saturation. It is **pinned nowhere in
the tree** — no service depends on it. So the queue choice is recorded but
unexercised, and `PIPELINE-RESEARCH §1` establishes the queue is load-bearing
from the first extraction endpoint.

## 5. What "measured quality" obliges the server to record

The product promises *zero shipped defects* and *measured quality*
(`CONTEXT.md:32`), and the anti-patterns forbid the easy version of measuring
it: no throughput counters anywhere, no probe visibility, **no aggregate
headline accuracy number**, no auto-tuning, no per-reviewer ranking.

So the server must record per-field provenance and per-engine readings
permanently — `field_readings` keeps pre-merge values *forever* so
disagreements stay inspectable (`CONTEXT.md:147`) — and must refuse to
summarise them into a single number. `LeaderboardCell` carries `no_truth_yet`
for exactly this reason: **`NO TRUTH YET` where golden coverage is below
threshold**, rather than a misleading average.

That is a real server obligation and an unusual one: the API must be capable of
*declining to answer* a question the data cannot support.
