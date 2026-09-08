"""`MAX_JSONB_BYTES` and `bounded_jsonb_object` — the ceiling on every `jsonb` column.

**ITS OWN MODULE BECAUSE `base.py` HIT THE 400-LINE CAP, AND `CONVENTIONS.md`
§11.3 SAYS WHAT TO DO ABOUT THAT: split by DOMAIN, never by "part 1 / part 2".**
This is a domain — what a `jsonb` column in this schema is allowed to be — and it
is one every model in the package may need while `base.py` is the module they all
import for the row scaffolding. §11.4 forbids the other way out: deleting a
docstring that records a measurement to hit a line cap.

`0112` is the revision, and it carries the rest: why `pg_column_size` is the
right function, why the number is one number rather than four, the contrast with
`0110`'s foreign key (a CHECK is not validated by an RLS-filtered query and needs
no `NO FORCE` dance), and the residual this does NOT close.
"""

from __future__ import annotations

from typing import Final

from sqlalchemy import CheckConstraint

__all__ = ["MAX_JSONB_BYTES", "bounded_jsonb_object"]


# THE CEILING ON EVERY `jsonb` COLUMN IN THIS SCHEMA, IN ONE PLACE. 64 KiB.
#
# `0112` adds the constraint to all four — `clients.delivery_config`,
# `fields.source_line_coords`, `field_readings.line_coords` and the vendored
# `procrastinate_jobs.args` — and carries the measurements: why
# `pg_column_size` is the right function (a CHECK is evaluated before TOAST
# compression, so it reads the UNCOMPRESSED size an attacker controls, and a
# megabyte of one repeated byte is refused), why one number rather than four,
# and the residual this does NOT close (a full page of maximum-size values is
# still ~13 MB).
#
# A CEILING AND NOT A SIZE MODEL, which is why `CONVENTIONS.md` §11.4's "do not
# collapse two constants that merely happen to be equal today" does not bite: the
# four columns' honest sizes differ by orders of magnitude and this number
# describes none of them.
MAX_JSONB_BYTES: Final = 65536


def bounded_jsonb_object(column: str, *, nullable: bool) -> CheckConstraint:
    """`<column>` is a JSON OBJECT and weighs at most `MAX_JSONB_BYTES`.

    A SHAPE FLOOR AND NOT A SHAPE MODEL. `jsonb_typeof(...) = 'object'` refuses
    an array, a string, a number, a boolean and the JSON `null` — every value
    whose reader would have to guess — and says nothing about which KEYS the
    object carries, because for `line_coords` that model does not exist yet
    (`0001`, and CLAUDE.md's rule against building past `OPEN`).

    `nullable` decides whether the constraint carries an `IS NULL` arm, and it is
    a parameter rather than derived from the column because this function is
    handed a NAME and cannot see the column. A null arm on a `NOT NULL` column is
    a reader wondering which of the two facts is wrong.

    THE NAME IS THE BARE RULE and the convention prefixes it —
    `ck_%(table_name)s_%(constraint_name)s` is the only pattern above that takes
    `%(constraint_name)s`. `0111` measured what a full name produces from the
    migration side: `ck_<table>_ck_<table>_…`, truncated to 63 bytes with a hash
    suffix, so the upgrade succeeded and the downgrade could not find its own
    constraint.

    `0112` REPEATS THIS EXPRESSION RATHER THAN IMPORTING IT, because a
    migration is a frozen snapshot. Nothing in Alembic compares the two —
    `alembic check` does not look at CHECK constraints at all, the same blind
    spot `test_schema_migration.py` records for enum labels — so the machine that
    keeps them honest is
    `tests/test_jsonb_columns_are_bounded.py::test_the_four_constraints_read_back
    _exactly_as_written`, which pins the live `pg_get_constraintdef` text.
    """
    bounded_object = (
        f"jsonb_typeof({column}) = 'object' AND pg_column_size({column}) <= {MAX_JSONB_BYTES}"
    )
    return CheckConstraint(
        f"{column} IS NULL OR ({bounded_object})" if nullable else bounded_object,
        name=f"{column}_is_a_bounded_object",
    )
