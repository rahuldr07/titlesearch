"""`tenant_fk` — the only way a table in this package points at another one.

**A SINGLE-COLUMN FOREIGN KEY TO A TENANT-SCOPED TABLE IS A DEFECT, AND THIS
FUNCTION EXISTS SO THAT WRITING ONE TAKES MORE EFFORT THAN WRITING THE RIGHT
THING.** Every tenant table's primary key is `(tenant_id, id)` (see
`base._TenantRow` for the cross-tenant existence oracle that key closes and the
measurement behind it), so `REFERENCES orders (id)` does not even name a key —
PostgreSQL rejects it outright. What it WOULD accept, and what this function
prevents anyone reaching for as the fix, is a unique index on `id` alone added to
make the short reference legal: that index reopens the oracle the composite key
was chosen to close, and it opens it on the referenced table rather than on the
one a reviewer is reading.

The composite form also carries a property the short form cannot: a child row
CANNOT name a parent in another tenant, because `tenant_id` appears on both
sides of the same constraint. That is a structural guarantee, not a policy one —
it holds for `titlepipe_owner`, for a migration, and with row-level security off.
RLS decides what a session may SEE; this decides what may be WRITTEN.

`ondelete` is deliberately not defaulted to anything. Retention and deletion are
Kaveri's (`record_class`, `legal_holds`), and a `CASCADE` typed here by habit
would be this file quietly making a disposal decision that the taxonomy has not
made yet. Callers pass `ondelete=` where the domain genuinely settles it and pass
nothing where it does not — a `RESTRICT`-by-default parent that refuses to
vanish under its children is the failure that gets noticed, and a `CASCADE`
nobody chose is the one that does not.
"""

from __future__ import annotations

import sqlalchemy as sa

TENANT_COLUMN = "tenant_id"


def tenant_fk(
    *,
    column: str,
    target_table: str,
    ondelete: str | None = None,
    name: str | None = None,
) -> sa.ForeignKeyConstraint:
    """`(tenant_id, <column>) REFERENCES <target_table> (tenant_id, id)`.

    `column` is the child's own column name (`package_id`, `order_id`), and it is
    passed rather than derived from `target_table` because the two genuinely
    differ: `fields.source_document_id` points at `documents`, and a derivation
    that assumed `<singular>_id` would have produced `document_id` and silently
    built a constraint on a column that does not exist — or, worse, on one that
    does and means something else.

    `name` IS THE ESCAPE HATCH FOR POSTGRESQL'S 63-BYTE IDENTIFIER LIMIT, AND
    IT IS NEEDED BECAUSE THE NAMING CONVENTION CAN GENERATE A LONGER NAME THAN
    THE DATABASE CAN HOLD. `base.NAMING_CONVENTION` renders a foreign key as
    `fk_<table>_tenant_id_<column>_<target_table>`, and four references in this
    package overflow — the one on `client_config_lines` comes out at 73
    characters. Left to itself PostgreSQL TRUNCATES to 63 rather than refusing,
    and a truncated name is the worst of both: the model and the catalog then
    disagree forever, `alembic check` reports drift that no edit resolves, and two
    long names sharing a 63-character prefix collide on the second `CREATE` with
    an `already exists` naming a constraint nobody wrote.

    **THE RULE WHEN IT OVERFLOWS, so that the next caller does not invent one:
    DROP THE `_<target_table>` SUFFIX AND KEEP THE COLUMNS.** The child column
    already names its target unambiguously (`config_version_id` can only point at
    `client_config_versions`), so the suffix is the redundant part, and dropping
    it is a stated rule rather than a truncation somebody eyeballed.

    **THE MACHINE THAT CATCHES A MISSED ONE:** `tests/test_model_identifiers.py`
    asserts every constraint and index name in `Base.metadata` is at most 63
    bytes. Nothing here can check it — this function does not know the child
    table's name, which is half of the generated identifier and is not decided
    until the class body that calls it is executed.

    The constraint is built fresh per call. A `ForeignKeyConstraint`, like the
    `PrimaryKeyConstraint` in `0001`, does NOT raise when added to a second
    table: it keeps the name it was given on first bind, and two constraints with
    one name is a migration-time `already exists` with no Python-level error
    anywhere.
    """
    return sa.ForeignKeyConstraint(
        [TENANT_COLUMN, column],
        [f"{target_table}.{TENANT_COLUMN}", f"{target_table}.id"],
        ondelete=ondelete,
        name=name,
    )
