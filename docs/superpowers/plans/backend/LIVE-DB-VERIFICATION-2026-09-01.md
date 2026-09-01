# Verified against the running database, 2026-09-01

Twelfth companion to `LEAD-MEASUREMENTS-2026-09-01.md`. Everything else in this
set was measured from source; this one was measured from **the database
itself**.

A live `postgres:18.4` container (`titlepipe-db-postgres-1`, database
`titlepipe`) is running on this host. Nothing in the plan documents said so,
and it is the cheapest available check on the claims Plans 01 and 02 recorded.

---

## 1. The schema matches the migrations

Nine tables, every one owned by `titlepipe_owner`: the seven skeleton tables,
plus `rules` and `alembic_version`.

```
audit_log|3   field_readings|4   fields|4   orders|3
packages|3    pages|3            rules|10   tenants|2      TOTAL 32
```

**This corrected a number of my own.** `SCHEMA-GAP` first reported 31 columns,
counted by regex over the migration source. `rules` actually has **10**:
`origin` and `status` are Postgres ENUMs constructed through a helper rather
than written as `sa.Column("origin", …)` literals, so the regex skipped them.

Method note worth keeping: **counting a schema by grepping its migration
undercounts every column built by a helper.** When a database is running, it is
both cheaper and more reliable than the source.

## 2. Forced RLS is real, and correctly scoped

```sql
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE …
```

| table | RLS enabled | RLS **forced** |
|---|---|---|
| `tenants`, `orders`, `packages`, `pages`, `fields`, `field_readings`, `audit_log` | ✅ | ✅ |
| `rules` | ❌ | ❌ |

All seven tenant tables carry `ENABLE` **and** `FORCE`. `rules` carries
neither, which is correct rather than an omission: the rulebook is
tenant-independent, and `GET /api/rules` returns every row to everyone by
ruling.

## 3. The five roles are as recorded

```
titlepipe_app        NOSUPERUSER NOBYPASSRLS LOGIN
titlepipe_blind      NOSUPERUSER NOBYPASSRLS LOGIN
titlepipe_migration  NOSUPERUSER NOBYPASSRLS LOGIN
titlepipe_owner      NOSUPERUSER NOBYPASSRLS NOLOGIN
titlepipe_worker     NOSUPERUSER NOBYPASSRLS LOGIN
```

`01-WHAT-HAPPENED`'s claims hold exactly: five roles, none superuser, none
bypassing RLS, and the owner cannot log in. That last property is what makes
forced RLS mean anything — a superuser bypasses it unconditionally.

## 4. The NA enum in the database is the ruled set

```
na_reason   | NOT_PRESENT, NOT_FOUND, NOT_STATED, PRESENT_UNREADABLE
rule_status | live, pending, retired
rule_origin | spec, escalation, reconciliation, complaint, senior
```

Exactly `decisions.md` D3, owner-ratified 2026-07-26. This is the third
independent confirmation that `HANDOFF §2a`'s "nobody has ruled on it" was
stale, and the strongest: the ruled set is *in the database*.

`rule_origin` and `rule_status` also match `contract/src/enums.ts` member for
member, so the contract and the schema agree on all three enums.

## 5. `fields` is empty — the migration window is still open

```
fields | 0
```

`HANDOFF §2a` warned that *"changing the set after data exists is a migration
on a live enum, so rule on it before anything writes to `fields`."* The ruling
happened, and **nothing has been written to `fields`** — so even if the owner
wanted to revisit D3, the cheap window has not closed.

That is worth knowing precisely because it will close the moment Plan 04 lands
and Plan 07 starts populating. It is not an argument to reopen a settled
question; it is a fact about cost that stops being true soon.

*(`orders` showed 2 rows and `tenants` 1 during this check. Both are transient
test-fixture writes from the `pytest` run minutes earlier, not persistent
state.)*

## 6. What this changes

Nothing structural. Every claim Plans 01 and 02 made about isolation, roles and
the enum **survives contact with the running system**, which is not the usual
outcome when documentation is checked against reality — this session found five
stale claims elsewhere in the tree.

The one substantive correction is the column count, and it moved a number in my
own document rather than theirs.

## 7. What I did not check

- I did not run the cross-tenant isolation probes. The `pytest` suite does that
  against a testcontainer, 249 tests pass, and re-deriving it by hand would
  re-prove what a positive-controlled suite already proves.
- I did not verify the `tenant_isolation` policy bodies or the grant sets, only
  that RLS is enabled and forced. `01-WHAT-HAPPENED` asserts the policy set is
  *exactly* one per table and the grantees are exactly
  `{titlepipe_owner, titlepipe_app}`; that remains unverified by me.
- I did not check the `audit_log` triggers fire, only that the table exists.
