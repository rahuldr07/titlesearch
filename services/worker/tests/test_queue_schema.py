"""What revision 0060 actually did, read back from the database that ran it.

Every assertion here connects as the role whose privilege is in question. A grant
proved as superuser is not proved: a superuser holds everything and bypasses RLS,
so the same test would pass against a migration that granted nothing.
"""

from __future__ import annotations

from collections.abc import Callable
from importlib import resources
from pathlib import Path

import psycopg
import pytest

VENDORED_SCHEMA = (
    Path(__file__).resolve().parents[3]
    / "services"
    / "core-api"
    / "migrations"
    / "sql"
    / "procrastinate_schema_3.9.0.sql"
)

QUEUE_TABLES = (
    "procrastinate_jobs",
    "procrastinate_events",
    "procrastinate_periodic_defers",
    "procrastinate_workers",
)

# `<sequence>: the roles that must hold USAGE on it`. Derived in the migration
# from the table grants; restated here as the EXPECTED shape, because a test that
# imported the migration's own derivation would agree with it by construction.
SEQUENCE_GRANTEES: dict[str, set[str]] = {
    "procrastinate_jobs_id_seq": {"titlepipe_worker", "titlepipe_app"},
    "procrastinate_events_id_seq": {"titlepipe_worker", "titlepipe_app"},
    "procrastinate_periodic_defers_id_seq": {"titlepipe_worker"},
    # `procrastinate_workers.id` is `GENERATED ALWAYS AS IDENTITY`, and an
    # identity column DOES create a real sequence in `public` — it is simply one
    # whose privileges PostgreSQL does not check, because it is internally
    # dependent on the column. So it belongs in this map with an EMPTY grantee
    # set rather than being left out: leaving it out would make the "these are
    # all the sequences" assertion below fail, and adding a grant for it would be
    # a privilege nothing needs. `test_the_identity_sequence_needs_no_grant`
    # inserts through it holding nothing, which is what makes the empty set a
    # measurement rather than a hope.
    "procrastinate_workers_id_seq": set(),
}


def test_the_vendored_schema_is_the_installed_librarys() -> None:
    """The committed DDL and the pinned library must be the same bytes.

    A migration is a frozen snapshot, so revision 0060 executes the committed
    file rather than `SchemaManager.get_schema()` — otherwise two databases
    stamped at the same revision could hold different schemas with nothing
    saying so.

    THIS IS THE MACHINE THAT KEEPS THE SNAPSHOT HONEST. When `procrastinate` is
    bumped, this goes red, at the point where somebody has to decide whether the
    delta needs a new revision — rather than silently changing what 0060 means on
    the next fresh database. It is a byte comparison on purpose: everything this
    repository adds (grants, comments, read-backs) is in the migration, not in
    the copy, so there is nothing here to weaken into a "close enough".
    """
    installed = (resources.files("procrastinate.sql") / "schema.sql").read_text(encoding="utf-8")
    assert VENDORED_SCHEMA.read_text(encoding="utf-8") == installed


def test_the_chain_installs_the_queue_objects(migrated: str) -> None:
    """`alembic upgrade head` — the operator's own command — leaves the objects."""
    with psycopg.connect(migrated) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT c.relname FROM pg_class c JOIN pg_namespace n "
                "ON n.oid = c.relnamespace WHERE n.nspname = 'public' "
                "AND c.relkind = 'r' AND c.relname LIKE 'procrastinate\\_%'"
            ).fetchall()
        }
        functions = connection.execute(
            "SELECT count(*) FROM pg_proc p JOIN pg_namespace n "
            "ON n.oid = p.pronamespace WHERE n.nspname = 'public' "
            "AND p.proname LIKE 'procrastinate\\_%'"
        ).fetchone()
        types = {
            row[0]
            for row in connection.execute(
                "SELECT t.typname FROM pg_type t JOIN pg_namespace n "
                "ON n.oid = t.typnamespace WHERE n.nspname = 'public' "
                "AND t.typtype = 'e' AND t.typname LIKE 'procrastinate\\_%'"
            ).fetchall()
        }

    assert tables == set(QUEUE_TABLES)
    assert functions is not None
    assert functions[0] == 18
    assert types == {"procrastinate_job_status", "procrastinate_job_event_type"}


def test_every_sequence_is_granted_to_the_roles_that_insert(migrated: str) -> None:
    """The claim that replaces `0002`'s "there are no sequences".

    🔴 THIS TEST IS THE OTHER HALF OF A COLLISION. `0002` asserts, in
    `services/core-api/tests/test_forced_rls_and_grants.py::test_there_are_no_sequences_for_a_sequence_grant_to_reach`,
    that schema `public` holds zero relations of kind `S`. That was true until
    0060, whose three `bigserial` columns end it — and that test's own docstring
    says it is "the test that notices the day that stops being true". It has
    noticed, and it is right to.

    The remedy is not to delete the claim but to strengthen it: every sequence in
    `public` is `USAGE`-granted to every role that inserts into the table owning
    it. That is the property the original was standing in for, and it stays true
    as more `bigserial` tables arrive. Editing core-api's suite is outside this
    worker's file set, so the replacement is offered here and the collision is
    reported to whoever integrates the chain.

    Without the grant the symptom is `permission denied for sequence
    procrastinate_jobs_id_seq` on the first defer — an error that names the
    sequence and not the grant.
    """
    with psycopg.connect(migrated) as connection:
        sequences = {
            row[0]
            for row in connection.execute(
                "SELECT c.relname FROM pg_class c JOIN pg_namespace n "
                "ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'S'"
            ).fetchall()
        }
        assert sequences == set(SEQUENCE_GRANTEES), (
            "a new sequence appeared in public; give it a USAGE grant in the "
            "migration that created it and add it here"
        )

        for sequence, expected in SEQUENCE_GRANTEES.items():
            for role in ("titlepipe_worker", "titlepipe_app"):
                row = connection.execute(
                    "SELECT has_sequence_privilege(%s, %s, 'USAGE')", (role, sequence)
                ).fetchone()
                assert row is not None
                assert row[0] is (role in expected), (
                    f"{role} USAGE on {sequence} should be {role in expected}"
                )


def test_the_identity_sequence_needs_no_grant(worker_dsn: str) -> None:
    """`procrastinate_workers.id` is IDENTITY, and gets no sequence grant.

    The migration says so and the claim is about PostgreSQL rather than about
    this repository, so it is measured rather than asserted: an identity column's
    sequence is internally dependent on the column and its privileges are not
    checked. `titlepipe_worker` inserts a row here holding nothing on that
    sequence — which is also, incidentally, what every worker registration does.
    """
    with psycopg.connect(worker_dsn) as connection:
        granted = connection.execute(
            "SELECT has_sequence_privilege('titlepipe_worker', "
            "'procrastinate_workers_id_seq', 'USAGE')"
        ).fetchone()
        assert granted is not None
        assert granted[0] is False

        inserted = connection.execute(
            "INSERT INTO procrastinate_workers DEFAULT VALUES RETURNING id"
        ).fetchone()
        assert inserted is not None
        assert inserted[0] > 0
        connection.rollback()


def test_the_queue_tables_are_marked_as_infrastructure(migrated: str) -> None:
    """The four tables carry a catalog comment a coverage check can key on.

    PLAN §5 rule 4 wants an assertion that every tenant-scoped table has RLS, and
    that check does not exist yet. These four are deliberately NOT tenant-scoped
    (revision 0060 records why, and what it costs), so the check will need to
    exempt them — and a hard-coded list of four names is the thing that ages.
    The marker lets the exemption be derived: a table in `public` with no
    `tenant_id` column is either commented as infrastructure or it is a defect.
    """
    with psycopg.connect(migrated) as connection:
        for table in QUEUE_TABLES:
            row = connection.execute(
                "SELECT obj_description(%s::regclass, 'pg_class')", (table,)
            ).fetchone()
            assert row is not None
            assert row[0] is not None
            assert str(row[0]).startswith("QUEUE-INFRASTRUCTURE:")

            columns = {
                column[0]
                for column in connection.execute(
                    "SELECT attname FROM pg_attribute WHERE attrelid = %s::regclass "
                    "AND attnum > 0 AND NOT attisdropped",
                    (table,),
                ).fetchall()
            }
            assert "tenant_id" not in columns


def test_the_app_role_can_defer_and_cannot_fetch(app_dsn: str) -> None:
    """The producer/consumer split, proved as the roles rather than described.

    core-api holds SELECT and INSERT so it can defer — `INSERT ... RETURNING id`
    is a read, which is why SELECT is not optional. It holds no UPDATE, so it
    cannot fetch, finish, cancel or abort a job. That absence is deliberate and
    is the "no privilege without a caller" rule: cancel and abort get their grant
    on the day an endpoint calls them.
    """
    with psycopg.connect(app_dsn) as connection:
        deferred = connection.execute(
            "SELECT unnest(procrastinate_defer_jobs_v1(ARRAY["
            "ROW('maintenance', 'titlepipe.probe', 0, NULL, NULL, '{}'::jsonb, NULL)"
            "]::procrastinate_job_to_defer_v1[]))"
        ).fetchone()
        assert deferred is not None
        assert deferred[0] > 0

        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            connection.execute(
                "SELECT * FROM procrastinate_fetch_job_v2(ARRAY['maintenance']::varchar[], NULL)"
            )
        connection.rollback()


def test_blind_holds_nothing_on_the_queue(migrated: str) -> None:
    """`titlepipe_blind` is not named anywhere in revision 0060.

    Blind is deferred rather than cancelled (owner ruling, 2026-09-05), and a
    deferred feature is not a relaxed invariant: its role keeps holding nothing
    it was not given. It is also intended for a separate database entirely, so a
    grant here would be wrong even when blind returns.
    """
    with psycopg.connect(migrated) as connection:
        for table in QUEUE_TABLES:
            for verb in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                row = connection.execute(
                    "SELECT has_table_privilege('titlepipe_blind', %s, %s)", (table, verb)
                ).fetchone()
                assert row is not None
                assert row[0] is False, f"titlepipe_blind holds {verb} on {table}"


def test_the_downgrade_removes_what_the_upgrade_created(
    migrated: str, alembic: Callable[..., None]
) -> None:
    """A real `downgrade()`, run rather than described.

    CONVENTIONS §8 requires one on every migration and calls `pass` a defect. The
    only way to know a `downgrade()` is real is to run it, and the only way to
    know it removed everything is to look afterwards — a `DROP FUNCTION` that
    misses a signature leaves the function behind and still exits 0.

    The round trip restores the database this session shares, so the assertions
    below are ordered to leave `head` behind whether or not they pass. The state
    it returns to is the one every other test in this suite depends on.
    """
    alembic("downgrade", "0004")
    with psycopg.connect(migrated) as connection:
        leftovers = connection.execute(
            "SELECT count(*) FROM ("
            "  SELECT c.relname FROM pg_class c JOIN pg_namespace n "
            "  ON n.oid = c.relnamespace WHERE n.nspname = 'public' "
            "  AND c.relname LIKE 'procrastinate\\_%' "
            "  UNION ALL "
            "  SELECT p.proname FROM pg_proc p JOIN pg_namespace n "
            "  ON n.oid = p.pronamespace WHERE n.nspname = 'public' "
            "  AND p.proname LIKE 'procrastinate\\_%' "
            "  UNION ALL "
            "  SELECT t.typname FROM pg_type t JOIN pg_namespace n "
            "  ON n.oid = t.typnamespace WHERE n.nspname = 'public' "
            "  AND t.typname LIKE 'procrastinate\\_%'"
            ") AS remaining"
        ).fetchone()

    alembic("upgrade", "head")

    assert leftovers is not None
    assert leftovers[0] == 0, (
        "downgrade left procrastinate_* objects behind — a table, a function, a "
        "type or an array type of one"
    )

    with psycopg.connect(migrated) as connection:
        restored = connection.execute(
            "SELECT count(*) FROM pg_class c JOIN pg_namespace n "
            "ON n.oid = c.relnamespace WHERE n.nspname = 'public' "
            "AND c.relkind = 'r' AND c.relname LIKE 'procrastinate\\_%'"
        ).fetchone()
    assert restored is not None
    assert restored[0] == len(QUEUE_TABLES)
