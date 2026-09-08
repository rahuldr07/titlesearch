# Trust model — who can defeat what, and what would notice

**Status: measured, 2026-09-08, against postgres:18.4 on the `0102` chain.**

This document exists because every reader so far has believed the audit trail is
tamper-proof against an operator holding the migration DSN. **It is not**, and
the ceiling was written down nowhere. The individual claims in the migration
docstrings are each true; what was missing is the one sentence that bounds all of
them at once.

Read this before writing "cannot", "immutable", "append-only" or "tamper-proof"
in a docstring, a PRD, or anything a customer sees.

---

## The one-line version

> Every append-only, ledger, chain and immutability guarantee in this database is
> enforced by a trigger or a constraint, and **every one of them can be switched
> off and switched back on by whoever holds `TITLEPIPE_DATABASE_URL`** — leaving
> a catalog that is byte-identical to one that was never touched.

That credential is `titlepipe_migration`. It is not a superuser. It does not need
to be.

---

## Why the migration role is the ceiling

`titlepipe_migration` is a `LOGIN` role and a member of `titlepipe_owner` with
`INHERIT FALSE, SET TRUE`. That membership is deliberate and is load-bearing for
a different reason — `migrations/env.py` hand-off 1 records that under plain
`INHERIT` every migrated table came out owned by a `LOGIN` role, which bypasses
row-level security. `INHERIT FALSE` fixed that.

What it does not do is create a privilege boundary. `SET ROLE titlepipe_owner` is
one statement, `env.py` issues it on every single run, and after it the session
**owns every table in the schema**. `ALTER TABLE` is gated on ownership, not on a
grantable privilege, so there is no grant to withhold.

`migrations/versions/0072_golden_fields_ledger_trigger.py` scoped its residual to
"a superuser remains a superuser." That is too generous by exactly one role.

---

## Measured: the whole sequence, as `titlepipe_migration`

Connected as `titlepipe_migration` with the ordinary migration DSN. Nothing else.

```
psql -U titlepipe_migration
  SET ROLE titlepipe_owner;

-- 1. the guarantee holds
  DELETE FROM reports WHERE id = '4444…';
  ERROR:  reports is append-only; DELETE is refused
  HINT:   Render a new version citing supersedes_version; v1 is the defect record.

-- 2. switch it off
  ALTER TABLE reports DISABLE TRIGGER reports_are_append_only;
  ALTER TABLE
  -- pg_trigger: reports_are_append_only | D

-- 3. the same statement, now
  DELETE FROM reports WHERE id = '4444…';
  DELETE 1
  -- reports_rows_remaining = 0

-- 4. put it back
  ALTER TABLE reports ENABLE ALWAYS TRIGGER reports_are_append_only;
  -- pg_trigger: reports_are_append_only | A

-- 5. what the database recorded about steps 2, 3 and 4
  SELECT count(*) FROM audit_log;
  0
```

The catalog after step 4 is indistinguishable from the catalog before step 2. The
row is gone. `audit_log` is empty. **Nothing in the database noticed.**

### The same route reaches the other guarantees

Driven in the same session, all three succeeded and all three restored clean:

```
ALTER TABLE audit_log     DISABLE TRIGGER audit_log_append_only;          -- D
ALTER TABLE golden_fields DISABLE TRIGGER golden_fields_no_delete;        -- D
ALTER TABLE golden_fields DISABLE TRIGGER golden_fields_ledger_required;  -- D
```

There is nothing special about `reports`. Every row in `pg_trigger` that is not
`tgisinternal` is reachable this way — counted on the bench at `0102`, **20
triggers across 10 tables**, excluding the seven Procrastinate installs, which
are the queue's and are at `'O'` by the library's own DDL.

### One correction, because the obvious command is refused

`ALTER TABLE reports DISABLE TRIGGER ALL` **fails**:

```
ERROR:  permission denied: "RI_ConstraintTrigger_a_17076" is a system trigger
```

`ALL` reaches the foreign-key constraint triggers, and those need superuser. This
is worth knowing precisely because it is misleading in the reassuring direction:
an operator who tries the blunt form and is refused may conclude the table is
protected. Naming the trigger works, and naming the trigger is what somebody
setting out to remove a row would do.

`tests/test_audit_log_append_only.py` proves `titlepipe_worker` — a role holding
nothing — is refused `DISABLE TRIGGER ALL` with `42501`. That test is correct and
it is about a role that is not the owner. It says nothing about this.

---

## `ENABLE ALWAYS` closes a different door, and closes it properly

`0004` promoted the append-only triggers from `tgenabled = 'O'` to `'A'`. That is
a real control and it is not weakened by anything above: it closes
`session_replication_role = 'replica'`, under which `'O'` triggers do not fire at
all. `0004`'s docstring carries the measurement.

The distinction that matters:

| Route | Needs | Closed by |
| --- | --- | --- |
| `session_replication_role = 'replica'` | `SUSET` — superuser | `ENABLE ALWAYS` (`0004`) |
| `pg_db_role_setting` planting the same GUC per-role | role admin | `roles.sql` convergence |
| `DISABLE TRIGGER <name>` | **table ownership** | **nothing** |
| `DROP TRIGGER` / `DROP TABLE` | **table ownership** | **nothing** |
| `ALTER TABLE … NO FORCE ROW LEVEL SECURITY` | **table ownership** | boot check, partially — see below |

The first two are closed. The last three are the subject of this document.

---

## What would notice — detection, not prevention

**Prevention is not available from inside the database.** A control that the
owner can switch off is not a control against the owner, and every mechanism this
codebase has — triggers, `FORCE ROW LEVEL SECURITY`, `CHECK` constraints,
`REVOKE` — is owned by the owner.

What an owner is *not* inside is **git**. The expectations live in the migration
chain: which triggers exist, on which tables, at which `tgenabled`, with which
`tgtype`. That is a fact recorded outside the cluster, by a process the database
credential has no reach into. So the answer is a check that reads the live
catalog and compares it to what the chain declares, and **reports a difference**
rather than trying to prevent one.

### What exists today

* `titlepipe_core/db/rls_coverage.py` — `assert_rls_coverage_async` runs at every
  application boot from `lifespan.py`. It reads the LIVE catalog for every schema
  and faults a table whose RLS is not enabled, not forced, or not scoped. This is
  exactly the shape described above, and it is the only instance of it.
* `tests/test_trigger_function_bodies.py` — the strongest git-side check that
  exists. It asserts each trigger function's BODY against a digest pinned in the
  test, plus `tgenabled = 'A'`, so a `CREATE OR REPLACE` that guts a function
  while leaving every catalog attribute intact is caught. `0101`'s docstring is
  right to name it: an owner who drops a trigger fails no statement, they fail
  this.
* `tests/test_schema_migration.py::test_audit_logs_triggers_are_the_named_three_before_and_enabled`
  and the trigger assertions in `tests/test_golden_set.py` and
  `tests/test_audit_log_append_only.py` read `tgenabled` and compare it to `'A'`.
* **`audit_chain_verify(p_tenant uuid)`** — the one detection mechanism that runs
  *in* the database and is not a test. `0007`'s per-tenant hash chain means a
  deleted `audit_log` row leaves a gap in `chain_position`, an edited row's stored
  `row_hash` stops matching a recomputation, and a re-hashed row breaks its
  successor's `prev_hash`. This is real, and it is the model for what the rest of
  the schema does not have. Its own ceiling is stated in `0007` and is not
  repeated here: whoever recomputes the WHOLE chain defeats it, and the external
  anchor that would close that does not exist.

### What that does not cover, stated plainly

1. **The trigger tests run against a testcontainer, not against production.**
   Nothing runs them against a live cluster, ever. `0004`'s docstring says an
   explicit `DISABLE TRIGGER` "leaves `tgenabled = 'D'`, which
   `tests/test_schema_migration.py` fails on" — true of the test's own database
   and of no other.
2. **Nothing checks trigger state at boot.** `lifespan.py` asserts RLS coverage
   and nothing else. A cluster running with `audit_log_append_only` at `'D'`
   starts, serves traffic, and reports itself healthy.
3. **A disable that is restored leaves nothing to find.** Even a boot-time
   trigger check would be a check on the state at boot. The sequence above spends
   about a second at `'D'`; a check that ran every minute would have to be lucky.
4. **`audit_log` records nothing about DDL.** It is a row-level audit of
   application writes. `ALTER TABLE` does not pass through it, and the
   measurement above confirms `count(*) = 0` after the whole sequence.
5. **`audit_chain_verify` covers `audit_log` and nothing else.** `reports`,
   `golden_fields` and `golden_corrections` carry append-only triggers and no
   chain, so a row deleted from any of them leaves no gap to find. The sequence
   measured above deleted a `reports` row for exactly that reason: it is the case
   with no detection at all, not the case `0007` already answers.

### What would close it, and it is not in this branch

The honest closure is outside the database's own trust domain:

* **PostgreSQL's DDL log**, `log_statement = 'ddl'`, shipped to somewhere the
  database credential cannot write — a log sink, not a table in this cluster. An
  `ALTER TABLE … DISABLE TRIGGER` is then a line in a log an operator holding
  only the migration DSN cannot edit. This is the cheapest real control and it is
  a deployment decision, not a code one.
* **A catalog-versus-chain assertion at boot**, the trigger analogue of
  `assert_rls_coverage_async`: every trigger the chain declares, present, at the
  `tgenabled` and `tgtype` the chain declares. This catches a permanent change
  and does not catch a temporary one.
* **A separate credential for schema change**, held by somebody who is not the
  application's deploy pipeline. This is the only one that changes who can do it
  at all, and it is a process control, not a schema one.

None of the three is implemented. Saying which would work is not the same as
having one.

---

## How to write about this

Guarantees in this system are **enforced against the application** and are
**evidence, not proof, against the operator**. Both halves are true and both
belong in the sentence.

* ✅ "`reports` is append-only: `DELETE` and `UPDATE` are refused by an
  `ENABLE ALWAYS` trigger for every role including the owner, and by
  `session_replication_role` for none of them. Ceiling: the trigger can be
  disabled by whoever can `SET ROLE titlepipe_owner`, which is the migration
  credential — see `docs/backend/TRUST-MODEL.md`."
* ❌ "`reports` is append-only and cannot be modified."
* ❌ "The audit trail is tamper-proof."
* ❌ "Nothing here is a control against whoever administers the cluster; a
  superuser remains a superuser." — true and too generous by one role. The role
  that matters is `titlepipe_owner`, reachable by `titlepipe_migration`, which is
  in a deployment's environment variables.

**The claim "the audit row cannot be suppressed from the application layer" is
exactly true and should be kept exactly that way.** It is scoped to the layer it
is about. It is the model for how the rest should read.
