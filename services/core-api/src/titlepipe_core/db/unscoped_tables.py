"""The tables in schema `public` that carry no tenancy, named once, in one place.

**A MODULE OF ITS OWN BECAUSE FIVE THINGS READ IT, NOT BECAUSE IT IS TIDY.** The RLS
coverage check, Alembic's autogenerate comparison in `migrations/env.py`, the isolation
seed's table derivation, the global-table assertion and the expected-table assertion all
enumerate schema `public` and all have to agree about which tables are outside tenancy.
Each of those was free to learn about a new table separately, or not at all, and the
integration merge is what proved they would not: `0060` installed four tables the
repository does not model and only one list heard about it.

`db.rls_coverage.UNSCOPED_TABLES` is still the name every caller uses — it is imported
below and re-exported from there — so this move changes where the list is WRITTEN and
nothing about where it is read.

**WHY A CONSTANT AND NOT THE CATALOG.** `0060` gives each of these tables a
`COMMENT ON TABLE` beginning `QUEUE-INFRASTRUCTURE:` and proposes deriving the
exemption from it. That would be the better mechanism for a check whose job is to
describe the database, and it is the WRONG one for a check whose job is to refuse
one: a comment is `COMMENT ON TABLE … IS …`, which every table owner can issue, so
a table could opt itself out of tenant isolation without a diff anybody reviews.
`db.rls_coverage`'s docstring states the requirement it is protecting — "a table
opts out only by being named in a constant a reviewer reads" — and that is this
constant. The comment `0060` writes is still worth having as documentation in the
catalog; it is not the authority.

**WHY THE FOUR QUEUE TABLES ARE NOT TENANT-SCOPED**, stated here because this is where the
exemption is granted. They are the queue's internal bookkeeping and carry no tenant
data of their own: a job row holds a task name and its arguments, and it is the
TASK's job to scope what it then reads. Giving them a `tenant_id` would be worse
than leaving them out — it would put the tenant of a job's payload in a third-party
table this repository does not own and cannot keep in step across upgrades. They
reach the database as vendor SQL, so they were never going to satisfy the
isolate-in-the-same-migration rule the coverage check enforces for our own tables.
`0060`'s header carries the same decision at greater length, including what it
costs: any role holding `SELECT` on `procrastinate_jobs` reads every tenant's job
arguments.

**THE RESIDUAL.** This set is spelled out rather than read from the vendored SQL, so
a Procrastinate upgrade that adds a fifth table is not noticed here. It is noticed
where it matters: `db.rls_coverage` refuses a table in `public` with no `tenant_id`
that is not on its allowlist, and `tests/conftest.py`'s isolation seed raises by
name on one. Both failures name the table and neither can be reached by accident.
"""

from __future__ import annotations

from typing import Final

__all__ = ["QUEUE_INFRASTRUCTURE_TABLES", "UNSCOPED_TABLES"]

# Vendored at 3.9.0 by `migrations/sql/procrastinate_schema_3.9.0.sql`; `0060::QUEUE_TABLES` is the
# same four names inside the migration that installs them, and is deliberately a separate spelling —
# a migration is a frozen snapshot of one revision and must not be rewritten by an edit here.
QUEUE_INFRASTRUCTURE_TABLES: Final = frozenset(
    {
        "procrastinate_events",
        "procrastinate_jobs",
        "procrastinate_periodic_defers",
        "procrastinate_workers",
    }
)


# THE ALLOWLIST. Every name here must NOT be isolated, and needs its reason in this comment and
# not in a commit message. Adding one is a reviewer-visible diff that has to argue the table has no
# tenant in it; `rls_coverage.exempt_table_is_tenant_scoped` stops the list being used the other way
# round — a name here that has grown a `tenant_id` is reported as a fault rather than honoured.
#
# `alembic_version` — Alembic's bookkeeping. An `id`-keyed policy on it locks Alembic out of its own
#   migration state; there is no tenant in it.
# `rules` — global by CONVENTIONS §1: the rulebook is the same for every tenant, its repository is a
#   SIBLING of the tenant-scoped ones, and a `tenant_id` would make the rulebook per-tenant.
# `retention_windows` — global for the same reason and one more: a statutory retention floor is not
#   a tenant's property, so a `tenant_id` would say a tenant may hold a shorter floor than the law.
#   `0005_record_class_taxonomy` creates it; `db/models/retention.py` declares it a `_Row`. It
#   reached this list only at integration — the first `upgrade head` over the chain failed on it.
# the four `procrastinate_*` tables — the queue's vendored schema, above.
UNSCOPED_TABLES: Final = (
    frozenset(
        {
            "alembic_version",
            "retention_windows",
            "rules",
        }
    )
    | QUEUE_INFRASTRUCTURE_TABLES
)
