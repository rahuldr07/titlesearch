"""The audit row cannot be suppressed from the application layer — proved, not asserted.

---------------------------------------------------------------------------
🔴 WHY THIS FILE EXISTS: THE CLAIM LIVED IN A COMMIT MESSAGE.
---------------------------------------------------------------------------
`0007` attaches `ENABLE ALWAYS` triggers and its docstring says the audit row is
written in the caller's transaction and cannot be turned off from the
application layer. Until this module, the machine behind that sentence was the
sentence. CONVENTIONS §9 names FALSE ASSURANCE as this codebase's characteristic
failure and requires a named machine per safety property; a prose claim about a
trigger is precisely the shape it warns about, because a trigger that was
dropped, left at plain `ENABLE`, or attached to no table at all reads identically
in the source.

Four properties, and each one is a separate section below:

1. **the row appears at all** — INSERT, UPDATE and DELETE on both audited tables
   produce a row naming the actor, the seat, the verb and the subject;
2. **same transaction** — the audit row is visible inside the writer's
   transaction and GOES WITH IT on rollback. Not a queue, not a shipper, not a
   background job (CONVENTIONS §5);
3. **the application cannot suppress it** — the four suppressions a determined
   developer actually reaches for, each measured: `session_replication_role`,
   `ALTER TABLE … DISABLE TRIGGER`, `DELETE FROM audit_log`, and supplying your
   own hash. Every one is refused or out of reach for `titlepipe_app`;
4. **`ENABLE ALWAYS` specifically** — a DIFFERENTIAL. The same insert is run
   twice under `session_replication_role = 'replica'`, once with the trigger as
   `0007` leaves it and once with it downgraded to plain `ENABLE`, and the second
   writes no audit row. That is the only form of this test that distinguishes
   "the trigger fired" from "`ENABLE ALWAYS` is why it fired".

## The suppressions, and what each of them is a proxy for

| attempt | who tries it | what stops it |
|---|---|---|
| `SET session_replication_role = 'replica'` | anyone who read `0004` | the GUC is superuser-only, so `titlepipe_app` gets `42501` — AND, where it does succeed, `ENABLE ALWAYS` means it changes nothing |
| `ALTER TABLE … DISABLE TRIGGER` | the developer with a failing test | table ownership, which `titlepipe_app` does not have: `42501` |
| `DELETE FROM audit_log` | the developer cleaning up | the ACL (`0002` withholds DELETE): `42501`. And for the owner, who has every privilege, `0001`'s append-only trigger: `0A000` |
| choosing your own `row_hash` | whoever wants the chain to agree with a rewrite | the `BEFORE INSERT` chain trigger overwrites all three chain columns unconditionally |

The first row is the interesting one and is the reason the differential in §4
exists. `session_replication_role` being superuser-only is NOT what makes the
audit safe — `0004` measured that a per-role default is applied at CONNECT, where
no in-session privilege check applies, so a role can arrive in replica mode
without ever issuing the statement. `ENABLE ALWAYS` is the control; the `42501`
is a second lock on a door that has a hinge.

## What this file does NOT prove, stated so it is not read as covered

* **the actor is who it says it is.** `app.actor_subject` is a GUC, and `0007`'s
  own comment is explicit that a role can set its own. What is proved here is
  that a change with NO actor is REFUSED (§3), not that a declared actor is
  authentic — that is the identity provider's job and it does not exist yet;
* **a complete rewrite is detected.** `audit_chain_verify` finds a gap, an edited
  row and a spliced row (§5 drives all three shapes it can reach), and cannot
  find an attacker who recomputes the whole chain. The external anchor PLAN.md §5
  assigns that to does not exist;
* **tables outside `AUDITED_TABLES` are audited.** They are not, and
  `test_exactly_these_tables_are_audited` pins the list so the gap stays visible.

## Nothing here is skipped, and every write is rolled back

Same rules as the rest of the database suite: if Docker is unavailable these
FAIL rather than skip. `audit_log` has no statement that empties it — `0001`'s
triggers refuse DELETE and TRUNCATE to the superuser as readily as to anyone
else — so every test in this module runs inside a connection it rolls back, and
the module-scoped `migrated_database` is left as each test found it. That is also
what makes `chain_position` deterministic: each test starts from an empty chain.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError

# `invalid_authorization_specification` — `0007`'s writer raises it by name when
# no actor is established. Asserted specifically for the reason
# `test_audit_log_append_only.py` gives about `0A000`: a misspelled column raises
# `42703` and a missing table raises `42P01`, and either would otherwise read as
# proof that the actor check works.
NO_ACTOR_SQLSTATE = "28000"

# `insufficient_privilege` — the ACL or an ownership check refusing. Every
# suppression in §3 that `titlepipe_app` cannot even attempt comes back as this.
INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501"

# `feature_not_supported` — `0001`'s append-only trigger. The owner's answer,
# where `42501` is impossible because the owner holds every privilege.
APPEND_ONLY_SQLSTATE = "0A000"

OWNER_ROLE = "titlepipe_owner"

# The GUCs `0007`'s writer reads. Kept as a mapping rather than four constants so
# a test that wants to omit ONE of them (§3's no-actor case) can do it by name.
ACTOR_SUBJECT_GUC = "app.actor_subject"
ACTOR_SEAT_GUC = "app.actor_seat"
TENANT_GUC = "app.current_tenant"

ACTOR_SUBJECT = "reviewer@titlepipe.example"

# 🔴 `"senior"` AND NOT `"senior_examiner"`, WHICH IS A REAL CHANGE AND NOT A
# TIDY-UP. `0100` resolves `(tenant_id, actor_subject, actor_seat)` against
# `users` and compares the declared seat to `users.role`, whose type is `0020`'s
# `user_role` enum — six labels, and `senior_examiner` is not one of them. A
# plausible-looking string that no seat can ever equal was exactly the kind of
# value that used to reach `audit_log.actor_seat` unchallenged.
ACTOR_SEAT = "senior"

# The two tables `0007` attaches the writer to. A LITERAL, deliberately, and the
# assertion in `test_exactly_these_tables_are_audited` compares it against the
# CATALOG in both directions — so a third table gaining the trigger fails here
# until somebody says so out loud, and `record_classifications` losing it fails
# here too. `0007`'s docstring records why `orders`/`packages`/`pages`/`fields`/
# `field_readings` are absent; this is the machine that keeps that absence from
# quietly becoming permanent.
AUDITED_TABLES = frozenset({"record_classifications", "legal_holds"})

WRITER_FUNCTION = "audit_record_change"
CHAIN_FUNCTION = "audit_chain_link"
CHAIN_TRIGGER = "audit_log_chain_link"

# `pg_trigger.tgenabled`: `'A'` is `ENABLE ALWAYS`, `'O'` is the plain `ENABLE`
# default. The differential in §4 turns one into the other and back.
ENABLE_ALWAYS = "A"
ENABLE_ORIGIN = "O"

# Every trigger in `public` that calls the writer, DERIVED from the catalog by
# the function it executes rather than by a name pattern — a trigger named
# something else that calls the writer is still an audited table, and a trigger
# named `audit_*` that calls something else is not.
AUDIT_TRIGGERS_SQL = """
SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled AS enabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE NOT t.tgisinternal
   AND n.nspname = 'public'
   AND t.tgfoid = (:writer)::regproc
 ORDER BY c.relname
"""

AUDIT_ROWS_SQL = """
SELECT action::text AS action,
       actor_subject,
       actor_seat,
       subject_table,
       subject_id,
       chain_position,
       prev_hash,
       row_hash,
       rule_id,
       rule_provenance
  FROM audit_log
 WHERE subject_id = :subject
 ORDER BY chain_position
"""


def _sqlstate(error: DBAPIError) -> str | None:
    """The five-character SQLSTATE psycopg attached, if it attached one.

    `isinstance` rather than a bare `getattr`, the same guard the rest of the
    database suite uses: `getattr` on a DBAPI exception hands back whatever is
    there, and comparing `Any` to a string is satisfied by `None`.
    """
    sqlstate = getattr(error.orig, "sqlstate", None)
    return sqlstate if isinstance(sqlstate, str) else None


def _declare(connection: Connection, **gucs: str) -> None:
    """`set_config(..., is_local => true)` for each GUC named.

    TRANSACTION-LOCAL, which is not a tidiness choice: every test here rolls
    back, and a session-level `SET` would survive the rollback and leak an actor
    into whatever ran next on a pooled connection. `set_config` rather than `SET`
    because the parameter name is a bind, and interpolating a GUC name into DDL
    is the one thing this file has no reason to do.
    """
    for name, value in gucs.items():
        connection.execute(
            text("SELECT set_config(:name, :value, true)"), {"name": name, "value": value}
        )


def _as_app(connection: Connection, tenant: UUID) -> None:
    """The session context an authenticated request would carry: tenant + actor.

    All three at once, because `titlepipe_app` needs the tenant GUC to satisfy
    `0005`/`0006`'s `tenant_isolation` policy on the write AND `0007`'s writer
    needs the actor pair to let the write happen at all. A test that wants one
    of them missing sets them by hand with `_declare`.

    🔴 AND THE SEAT ITSELF, WHICH IS NEW AND IS THE POINT OF `0100`. Declaring an
    actor is no longer enough to write an audit row: `audit_log_bind_actor`
    resolves the pair against `users` in the row's tenant and refuses `28000`
    unless it names an ACTIVE row holding that exact seat. So a request context
    that used to be three `set_config` calls is now three `set_config` calls and
    a person who exists. `ON CONFLICT DO NOTHING` because several tests reuse a
    tenant across statements in one connection.

    The insert is AFTER `_declare`, and the order is load-bearing: `users` is
    under `FORCE ROW LEVEL SECURITY`, so a row written before the tenant GUC is
    established is refused by `tenant_isolation`'s `WITH CHECK`.
    """
    _declare(
        connection,
        **{
            TENANT_GUC: str(tenant),
            ACTOR_SUBJECT_GUC: ACTOR_SUBJECT,
            ACTOR_SEAT_GUC: ACTOR_SEAT,
        },
    )
    connection.execute(
        text(
            "INSERT INTO users ("
            "  tenant_id, email, role, identity_provider, identity_subject"
            ") VALUES ("
            "  :tenant, :email, :seat, 'test-fixture', :subject"
            ") ON CONFLICT DO NOTHING"
        ),
        {
            "tenant": tenant,
            # Lower-case because `ck_users_email_is_lowercase` refuses anything
            # else, and derived from the subject so the two cannot drift apart.
            "email": ACTOR_SUBJECT.lower(),
            "seat": ACTOR_SEAT,
            "subject": ACTOR_SUBJECT,
        },
    )


def _insert_classification(connection: Connection, tenant: UUID) -> UUID:
    """One `record_classifications` row. Returns its `id` — the audit subject.

    `derived_artifact`/`ops` rather than an NPI class, so nothing in this file's
    fixtures is a value anybody would have to think about if a failure dump
    reached a log. The class is irrelevant to every assertion here; what matters
    is that the row is tenant-scoped and has an `id`, which is all `0007`'s
    generic writer requires of a table.
    """
    return connection.execute(
        text(
            "INSERT INTO record_classifications ("
            "  tenant_id, subject_table, subject_id, record_class, data_class,"
            "  jurisdiction, classified_by, classification_basis"
            ") VALUES ("
            "  :tenant, 'orders', :subject, 'derived_artifact', 'ops',"
            "  'TX', :actor, 'test fixture'"
            ") RETURNING id"
        ),
        {"tenant": tenant, "subject": uuid4(), "actor": ACTOR_SUBJECT},
    ).scalar_one()


def _insert_hold(connection: Connection, tenant: UUID) -> UUID:
    """One `legal_holds` row. Returns its `id`."""
    return connection.execute(
        text(
            "INSERT INTO legal_holds ("
            "  tenant_id, subject_table, subject_id, matter_reference, reason, placed_by"
            ") VALUES ("
            "  :tenant, 'orders', :subject, 'MATTER-1', 'test fixture', :actor"
            ") RETURNING id"
        ),
        {"tenant": tenant, "subject": uuid4(), "actor": ACTOR_SUBJECT},
    ).scalar_one()


def _audit_rows(connection: Connection, subject: UUID) -> Sequence[Mapping[str, Any]]:
    """Every audit row naming `subject`, oldest first."""
    return [
        dict(row)
        for row in connection.execute(text(AUDIT_ROWS_SQL), {"subject": subject}).mappings()
    ]


def _become_owner(connection: Connection) -> None:
    """`SET ROLE titlepipe_owner`, and CHECK it took.

    `test_audit_log_append_only.py`'s reasoning, which applies verbatim: a failed
    `SET ROLE` raises `42501`, and `42501` is also what an ACL refusal looks
    like, so an unverified `SET ROLE` cannot tell "the owner was refused by the
    trigger" from "we never became the owner".
    """
    connection.execute(text(f"SET ROLE {OWNER_ROLE}"))
    who = connection.execute(text("SELECT current_user")).scalar_one()
    assert who == OWNER_ROLE, (
        f"SET ROLE did not take: this ran as {who!r}, so whatever the statement "
        f"below returns says nothing about the owner's path"
    )


# --- 1. the row appears at all ----------------------------------------------


@pytest.mark.parametrize(
    ("table", "insert"),
    [("record_classifications", _insert_classification), ("legal_holds", _insert_hold)],
)
def test_an_insert_on_an_audited_table_writes_an_audit_row(
    table: str,
    insert: Callable[[Connection, UUID], UUID],
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """🔴 THE BASELINE THE OTHER THREE SECTIONS ARE DIFFERENTIALS AGAINST.

    An ordinary application write, as `titlepipe_app`, with nothing unusual
    about it — and one audit row naming the actor, the seat, the verb and the
    subject comes out the other side. Both audited tables are parametrised
    rather than looped, so "classifications are audited and holds are not" is
    visible as a single failure rather than hidden behind the first assert.

    Every field is asserted, not just the row count. A writer that fired and
    recorded the wrong table, or `NULL` where the seat belongs, is a legal record
    that exists and does not say anything — which is the same failure as no
    record, arriving with more confidence.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant)
            subject = insert(connection, tenant)
            rows = _audit_rows(connection, subject)
            connection.rollback()
    finally:
        engine.dispose()

    assert len(rows) == 1, f"expected exactly one audit row for the insert into {table}, got {rows}"
    (row,) = rows
    assert row["action"] == "insert"
    assert row["subject_table"] == table
    assert row["subject_id"] == subject
    assert row["actor_subject"] == ACTOR_SUBJECT
    assert row["actor_seat"] == ACTOR_SEAT
    assert row["chain_position"] == 1, (
        "the first row of an empty tenant's chain is position 1; a different "
        "number means this module's rollback discipline slipped and an earlier "
        "test committed"
    )
    assert row["prev_hash"] is None, "the first row in a tenant's chain has no predecessor"
    assert row["row_hash"] is not None


def test_an_update_writes_a_second_audit_row_and_extends_the_chain(
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """Reclassification is an UPDATE, and the before/after of it is the point.

    `0005` grants UPDATE on `record_classifications` and withholds DELETE
    precisely so reclassification is a recorded act rather than a replacement.
    This asserts the recording: two rows, `insert` then `update`, at consecutive
    chain positions with the second's `prev_hash` equal to the first's
    `row_hash`.

    🔴 WHAT THE SECOND ROW DOES NOT CONTAIN IS THE OLD CLASS. `0007` ships the
    ASSERTION half of the audit row and no payload column at all, so this row
    records THAT the classification changed, by whom and under what seat, and
    NOT what it changed from or to. That is the gap `build-retention-audit.md`
    §7 carries as an unmet requirement of PLAN.md §5, and it is asserted here —
    `payload` not being a column — so the gap cannot close by accident and go
    unnoticed either.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant)
            subject = _insert_classification(connection, tenant)
            connection.execute(
                text("UPDATE record_classifications SET record_class = 'policy' WHERE id = :id"),
                {"id": subject},
            )
            rows = _audit_rows(connection, subject)
            columns = set(
                connection.execute(
                    text(
                        "SELECT attname FROM pg_attribute "
                        "WHERE attrelid = 'audit_log'::regclass "
                        "AND attnum > 0 AND NOT attisdropped"
                    )
                )
                .scalars()
                .all()
            )
            connection.rollback()
    finally:
        engine.dispose()

    assert [row["action"] for row in rows] == ["insert", "update"]
    assert [row["chain_position"] for row in rows] == [1, 2]
    assert rows[1]["prev_hash"] == rows[0]["row_hash"], (
        "the second row's prev_hash is not the first row's row_hash, so the "
        "chain is not linked and audit_chain_verify would report it"
    )
    assert not columns & {"payload", "payload_ciphertext", "before_value", "after_value"}, (
        "a payload column has appeared on audit_log. 0007 ships the assertion "
        "half deliberately and build-retention-audit.md section 7 carries the "
        "absence as an open requirement; if this is now built, that section is "
        "stale and the encryption question it is gated on has been answered"
    )


def test_a_delete_on_an_audited_table_is_recorded_with_the_row_it_removed(
    migrated_database: str,
    migration_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """The `OLD` branch of the writer, which no other test in this file reaches.

    Run as the OWNER and not as `titlepipe_app`, and the role is the content:
    `0005` and `0006` deliberately grant no DELETE to the application, so the
    application path cannot exercise this branch at all — `COALESCE(NEW, OLD)`
    would go untested and a `DELETE` reaching the table by any privileged route
    (a data migration, a `psql` session) would raise a NULL-subject error at the
    worst possible moment. The owner is the route that exists.
    """
    tenant = uuid4()
    engine = seam_engine(migration_dsn)
    try:
        with engine.connect() as connection:
            _become_owner(connection)
            _as_app(connection, tenant)
            subject = _insert_classification(connection, tenant)
            connection.execute(
                text("DELETE FROM record_classifications WHERE id = :id"), {"id": subject}
            )
            rows = _audit_rows(connection, subject)
            connection.rollback()
    finally:
        engine.dispose()

    assert [row["action"] for row in rows] == ["insert", "delete"]
    assert rows[1]["subject_id"] == subject, (
        "the delete's audit row does not name the row it removed, which means "
        "COALESCE(NEW, OLD) did not fall through to OLD"
    )


def test_a_change_with_no_actor_is_refused_rather_than_recorded_anonymously(
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """🔴 THE PROPERTY THAT MAKES THE WRITER A CONTROL AND NOT A CONVENTION.

    An application that forgets to establish an actor does not get an
    unattributed audit row — it gets a failed write. There is therefore no path
    that mutates an audited table without saying who did it, which is a
    different and much stronger statement than "the audit row has an actor
    column".

    The tenant GUC IS set here and only the actor pair is missing, so the
    `28000` that comes back cannot be an RLS denial wearing another number.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _declare(connection, **{TENANT_GUC: str(tenant)})
            with pytest.raises(DBAPIError) as raised:
                _insert_classification(connection, tenant)
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == NO_ACTOR_SQLSTATE, (
        f"expected {NO_ACTOR_SQLSTATE} for a change with no actor, got "
        f"{_sqlstate(raised.value)}: {raised.value}"
    )
    assert "no actor is established" in str(raised.value)


# --- 2. the audit row is written in the SAME TRANSACTION ---------------------


def test_a_rolled_back_change_leaves_no_audit_row(
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """🔴 THE "SAME TRANSACTION" REQUIREMENT, DRIVEN RATHER THAN ARGUED.

    CONVENTIONS §5 and PLAN.md §5: the audit write happens in the same
    transaction as the change it records — *not a queue, not a log shipper, not a
    background job*. A trigger satisfies that by construction, and "by
    construction" is exactly the kind of claim this codebase gets wrong, so it is
    measured in both directions on the same subject id:

    * INSIDE the transaction the audit row is visible — proving the write is not
      deferred to some later commit hook;
    * after the ROLLBACK, on a SEPARATE connection, neither the domain row nor
      its audit row exists — proving the audit write was not sent somewhere the
      rollback could not reach.

    The second connection matters. Reading back on the same connection would be
    satisfied by a transaction that never rolled back at all.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant)
            subject = _insert_classification(connection, tenant)
            seen_inside = _audit_rows(connection, subject)
            connection.rollback()

        with engine.connect() as connection:
            _as_app(connection, tenant)
            seen_after = _audit_rows(connection, subject)
            survivors = connection.execute(
                text("SELECT count(*) FROM record_classifications WHERE id = :id"),
                {"id": subject},
            ).scalar_one()
            connection.rollback()
    finally:
        engine.dispose()

    assert len(seen_inside) == 1, (
        "the audit row was not visible inside the writer's own transaction, so "
        "it is not being written in it"
    )
    assert survivors == 0, "the rolled-back insert survived; this test proves nothing"
    assert seen_after == [], (
        "the change rolled back and its audit row did not. The audit write is "
        "reaching a destination the caller's transaction does not control, "
        "which means an audit row can outlive a change that never happened"
    )


# --- 3. the application layer cannot suppress the row ------------------------


def test_the_app_role_cannot_turn_off_replication_triggers(
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """`SET session_replication_role = 'replica'` — the first thing anybody tries.

    Superuser-only, so `titlepipe_app` cannot issue it. This is the WEAKER of the
    two locks on this door and is asserted as such: `0004` measured that a
    per-role `ALTER ROLE … SET session_replication_role` default is applied at
    CONNECT, where no in-session privilege check applies, so a role can arrive in
    replica mode having never run this statement. The control that survives that
    is `ENABLE ALWAYS`, and the differential below is what proves it.
    """
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            with pytest.raises(DBAPIError) as raised:
                connection.execute(text("SET session_replication_role = 'replica'"))
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
        f"expected {INSUFFICIENT_PRIVILEGE_SQLSTATE}, got {_sqlstate(raised.value)}: {raised.value}"
    )


@pytest.mark.parametrize(
    "statement",
    [
        "ALTER TABLE record_classifications DISABLE TRIGGER audit_record_classifications",
        "ALTER TABLE record_classifications DISABLE TRIGGER ALL",
        "DROP TRIGGER audit_record_classifications ON record_classifications",
        f"ALTER TABLE audit_log DISABLE TRIGGER {CHAIN_TRIGGER}",
    ],
)
def test_the_app_role_cannot_detach_or_disable_the_audit_trigger(
    statement: str,
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """The second suppression: reach past the GUC and go at the trigger itself.

    All four spellings, because they fail for the same reason and a reader
    should not have to take that on trust — `DISABLE TRIGGER` and `DROP TRIGGER`
    are both `ALTER TABLE`-class operations requiring table OWNERSHIP, which
    `titlepipe_app` does not have and cannot grant itself. `DISABLE TRIGGER ALL`
    is included because it is the one a developer reaches for when the named
    form fails, and the chain trigger on `audit_log` because disabling it would
    leave rows unhashed rather than unwritten.
    """
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            with pytest.raises(DBAPIError) as raised:
                connection.execute(text(statement))
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
        f"expected {INSUFFICIENT_PRIVILEGE_SQLSTATE} for {statement!r}, got "
        f"{_sqlstate(raised.value)}: {raised.value}"
    )


def test_the_app_role_cannot_delete_the_audit_row_it_just_caused(
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """The third suppression: let the row be written, then remove it.

    The DELETE is aimed at a row the writer ACTUALLY PRODUCED in this same
    transaction, and that is the difference between this and
    `test_forced_rls_and_grants.py::test_audit_log_is_granted_insert_but_never
    _update`, which issues its DELETE against whatever happens to be in the
    table. A suppression attempt that finds nothing to delete cannot fail
    informatively.

    `42501` and not `0A000`: `0002` withholds the DELETE grant, so the ACL
    refuses before `0001`'s trigger is consulted. The owner's path — where no
    grant is missing and the trigger is the only thing left — is the next test.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant)
            subject = _insert_classification(connection, tenant)
            assert len(_audit_rows(connection, subject)) == 1
            with pytest.raises(DBAPIError) as raised:
                connection.execute(
                    text("DELETE FROM audit_log WHERE subject_id = :id"), {"id": subject}
                )
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
        f"expected {INSUFFICIENT_PRIVILEGE_SQLSTATE}, got {_sqlstate(raised.value)}: {raised.value}"
    )


def test_even_the_owner_cannot_delete_the_audit_row_the_writer_produced(
    migrated_database: str,
    migration_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """The most privileged path a deployment has, against a real audit row.

    `titlepipe_migration` + `SET ROLE titlepipe_owner` is what every migration
    runs as and the owner OWNS `audit_log`, so there is no grant missing and the
    refusal can only be `0001`'s append-only trigger — `0A000`, asserted
    specifically, because `42501` here would mean the `SET ROLE` silently failed.

    `test_audit_log_append_only.py` already drives the owner's DELETE. It does
    so against a table it filled itself with a bare `INSERT INTO audit_log
    (tenant_id)`, which `0007`'s NOT NULL assertion columns now make impossible.
    This is that proof re-established on the only rows the table can hold any
    more: the ones the writer produced.
    """
    tenant = uuid4()
    engine = seam_engine(migration_dsn)
    try:
        with engine.connect() as connection:
            _become_owner(connection)
            _as_app(connection, tenant)
            subject = _insert_classification(connection, tenant)
            assert len(_audit_rows(connection, subject)) == 1
            with pytest.raises(DBAPIError) as raised:
                connection.execute(
                    text("DELETE FROM audit_log WHERE subject_id = :id"), {"id": subject}
                )
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == APPEND_ONLY_SQLSTATE, (
        f"expected the append-only trigger's {APPEND_ONLY_SQLSTATE} as "
        f"{OWNER_ROLE}, got {_sqlstate(raised.value)}: {raised.value}"
    )
    assert "append-only" in str(raised.value)


def test_an_application_supplied_hash_is_overwritten(
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """The fourth suppression: don't remove the row, make the chain agree with you.

    `titlepipe_app` HOLDS `INSERT` on `audit_log` — it has to, because `0007`'s
    writer is not `SECURITY DEFINER` and inserts as the caller. So a caller can
    write an audit row directly and choose every value in it, including the three
    chain columns. `0007`'s `BEFORE INSERT` trigger overwrites all three
    unconditionally, without checking whether they were supplied and without
    complaining — refusing would tell an attacker which field to leave alone.

    Both halves are asserted. The chosen values are gone, AND the values that
    replaced them are the ones a correct chain would have: position 1 for the
    first row of an empty tenant, no predecessor, and a hash that is not the
    supplied one.
    """
    tenant = uuid4()
    subject = uuid4()
    chosen_hash = b"\x01" * 32
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant)
            connection.execute(
                text(
                    "INSERT INTO audit_log ("
                    "  tenant_id, actor_subject, actor_seat, action,"
                    "  subject_table, subject_id, row_hash, prev_hash, chain_position"
                    ") VALUES ("
                    "  :tenant, :actor, :seat, 'insert',"
                    "  'record_classifications', :subject, :chosen, :chosen, 9999"
                    ")"
                ),
                {
                    "tenant": tenant,
                    "actor": ACTOR_SUBJECT,
                    "seat": ACTOR_SEAT,
                    "subject": subject,
                    "chosen": chosen_hash,
                },
            )
            (row,) = _audit_rows(connection, subject)
            connection.rollback()
    finally:
        engine.dispose()

    assert row["chain_position"] == 1, (
        f"the caller chose chain_position 9999 and kept it ({row['chain_position']}), "
        f"so a caller can place a row anywhere in the chain"
    )
    assert row["prev_hash"] is None, "the caller's prev_hash survived"
    assert bytes(row["row_hash"]) != chosen_hash, (
        "the caller's row_hash survived, so the hash no longer says anything "
        "about the row's content"
    )


# --- 4. ENABLE ALWAYS specifically, as a differential ------------------------


def test_enable_always_is_why_the_writer_survives_replica_mode(
    migrated_database: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """🔴 THE ONLY TEST HERE THAT DISTINGUISHES *WHY* THE TRIGGER FIRED.

    Every other test in this file passes just as happily with the trigger at
    plain `ENABLE`, because nothing else puts the session into replica mode. This
    one runs the SAME insert twice under `session_replication_role = 'replica'`
    and changes exactly one thing between the halves:

    * **as `0007` leaves it** (`tgenabled = 'A'`) — the audit row is written;
    * **downgraded to plain `ENABLE`** (`tgenabled = 'O'`) — NO audit row is
      written, and the domain row lands anyway.

    The second half is the control, and without it the first proves only that
    something fired. With it, the delta is attributable to the one catalog
    character that differs.

    Run as the container superuser because both halves need privileges the
    application deliberately lacks — `session_replication_role` is superuser-only
    and `ALTER TABLE … ENABLE TRIGGER` needs ownership. That is fine here and is
    NOT fine as a proof of refusal, which is why every §3 test connects as
    `titlepipe_app` instead. The downgrade is DDL inside a transaction that is
    rolled back, so the catalog is left at `'A'`; the final assertion reads it
    back to say so rather than assuming it.

    `SET LOCAL` for the same reason `_declare` uses `is_local => true`: a
    session-level replica mode surviving into the next test would silently
    disarm every trigger the rest of this module depends on.
    """
    engine = seam_engine(migrated_database)
    tenant = uuid4()
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant)
            connection.execute(text("SET LOCAL session_replication_role = 'replica'"))
            always_subject = _insert_classification(connection, tenant)
            under_always = _audit_rows(connection, always_subject)
            connection.rollback()

        with engine.connect() as connection:
            _as_app(connection, tenant)
            connection.execute(
                text(
                    "ALTER TABLE record_classifications ENABLE TRIGGER audit_record_classifications"
                )
            )
            downgraded = connection.execute(
                text(AUDIT_TRIGGERS_SQL), {"writer": WRITER_FUNCTION}
            ).mappings()
            downgraded_state = {
                row["table_name"]: row["enabled"]
                for row in downgraded
                if row["table_name"] == "record_classifications"
            }
            connection.execute(text("SET LOCAL session_replication_role = 'replica'"))
            plain_subject = _insert_classification(connection, tenant)
            under_plain = _audit_rows(connection, plain_subject)
            landed = connection.execute(
                text("SELECT count(*) FROM record_classifications WHERE id = :id"),
                {"id": plain_subject},
            ).scalar_one()
            connection.rollback()

        with engine.connect() as connection:
            restored = {
                row["table_name"]: row["enabled"]
                for row in connection.execute(
                    text(AUDIT_TRIGGERS_SQL), {"writer": WRITER_FUNCTION}
                ).mappings()
            }
            connection.rollback()
    finally:
        engine.dispose()

    assert downgraded_state == {"record_classifications": ENABLE_ORIGIN}, (
        f"the control half did not actually downgrade the trigger "
        f"({downgraded_state}), so the two halves are not comparable"
    )
    assert len(under_always) == 1, (
        "the writer did NOT fire under session_replication_role = 'replica' "
        "with the trigger at ENABLE ALWAYS. The audit row is suppressible by a "
        "session setting, which is the whole failure 0004 exists to prevent"
    )
    assert landed == 1, (
        "the control half's domain row did not land, so its empty audit result "
        "says nothing about the trigger"
    )
    assert under_plain == [], (
        "a PLAIN ENABLE trigger also fired under replica mode. Either the "
        "downgrade did not take or this database ignores "
        "session_replication_role — and if the plain form is equally safe, the "
        "ENABLE ALWAYS claim in 0004 and 0007 is decoration"
    )
    assert restored == dict.fromkeys(AUDITED_TABLES, ENABLE_ALWAYS), (
        f"the control's ALTER TABLE outlived its rolled-back transaction: "
        f"{restored}. Every later test in this module is now running against a "
        f"weakened trigger"
    )


def test_exactly_these_tables_are_audited(
    migrated_database: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """The audited set, pinned in BOTH directions, so the gap cannot go quiet.

    `0007` attaches the writer to `record_classifications` and `legal_holds` and
    NOT to `orders`, `packages`, `pages`, `fields` or `field_readings` — its
    docstring gives the reason (they are being remodelled this phase) and states
    the consequence: **a change to a field's value is not audited today.**

    A test asserting only "these two are audited" would go on passing forever
    while that stayed true. This asserts SET EQUALITY against the catalog, so
    the day somebody attaches the trigger to a sixth table this file fails and
    the person adding it has to delete a line here — which is the moment to
    check whether `build-retention-audit.md` §7's stated gap is still accurate.

    `tgenabled` is asserted per trigger in the same pass. `ALTER TABLE … ENABLE
    ALWAYS TRIGGER` succeeds whatever the catalog ends up saying, so the value
    is the only evidence the statement did anything — `0007::_attach` reads it
    back at migration time and this reads it back afterwards, which is the check
    that survives somebody editing the migration.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            writers = [
                dict(row)
                for row in connection.execute(
                    text(AUDIT_TRIGGERS_SQL), {"writer": WRITER_FUNCTION}
                ).mappings()
            ]
            chain = [
                dict(row)
                for row in connection.execute(
                    text(AUDIT_TRIGGERS_SQL), {"writer": CHAIN_FUNCTION}
                ).mappings()
            ]
            connection.rollback()
    finally:
        engine.dispose()

    assert {row["table_name"] for row in writers} == AUDITED_TABLES, (
        f"the set of tables carrying the audit writer has changed: "
        f"{sorted(row['table_name'] for row in writers)}"
    )
    assert all(row["enabled"] == ENABLE_ALWAYS for row in writers), (
        f"a writer trigger is not ENABLE ALWAYS: {writers}. A trigger at "
        f"{ENABLE_ORIGIN!r} is off for any session whose "
        f"session_replication_role is 'replica'"
    )
    assert [(row["table_name"], row["trigger_name"], row["enabled"]) for row in chain] == [
        ("audit_log", CHAIN_TRIGGER, ENABLE_ALWAYS)
    ], f"the chain trigger is not a single ENABLE ALWAYS trigger on audit_log: {chain}"


# --- 5. what the chain detects, and what it does not -------------------------


def test_audit_chain_verify_reports_a_row_removed_behind_the_triggers(
    migrated_database: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """🔴 THE DETECTOR, DRIVEN ON THE ONE ATTACK THAT CAN ACTUALLY REACH THE TABLE.

    `audit_chain_verify` exists for the attacker the append-only triggers cannot
    stop — a superuser, a restore, a direct catalog write. So the test has to BE
    that attacker: the container superuser disables every trigger on `audit_log`
    (which is the only way a DELETE gets through at all — `0004` made them
    `ENABLE ALWAYS`, so even the superuser is refused while they are on) and
    removes the middle row of a three-row chain.

    Two findings are expected and both are asserted by name, because they are
    different evidence: the `gap` says a position is missing, and the
    `prev_hash mismatch` on the following row says the survivors no longer link.
    A tamperer who repaired only one of them would still be caught by the other.

    Everything is rolled back, including the `DISABLE TRIGGER ALL`, and the last
    block reads the chain back clean to prove the harm did not escape the
    transaction.
    """
    engine = seam_engine(migrated_database)
    tenant = uuid4()
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant)
            subject = _insert_classification(connection, tenant)
            connection.execute(
                text("UPDATE record_classifications SET record_class = 'policy' WHERE id = :id"),
                {"id": subject},
            )
            connection.execute(
                text("UPDATE record_classifications SET jurisdiction = 'CA' WHERE id = :id"),
                {"id": subject},
            )
            before = [
                dict(row)
                for row in connection.execute(
                    text("SELECT * FROM audit_chain_verify(:tenant)"), {"tenant": tenant}
                ).mappings()
            ]

            connection.execute(text("ALTER TABLE audit_log DISABLE TRIGGER ALL"))
            connection.execute(
                text("DELETE FROM audit_log WHERE tenant_id = :tenant AND chain_position = 2"),
                {"tenant": tenant},
            )
            after = [
                dict(row)
                for row in connection.execute(
                    text("SELECT * FROM audit_chain_verify(:tenant)"), {"tenant": tenant}
                ).mappings()
            ]
            connection.rollback()

        with engine.connect() as connection:
            enabled = connection.execute(
                text(
                    "SELECT tgenabled FROM pg_trigger "
                    "WHERE tgrelid = 'audit_log'::regclass AND NOT tgisinternal"
                )
            ).scalars()
            surviving_states = sorted(set(enabled))
            connection.rollback()
    finally:
        engine.dispose()

    assert before == [], (
        f"a chain the writer built by itself does not verify: {before}. Every "
        f"finding below would be unattributable"
    )
    assert {(row["chain_position"], row["problem"]) for row in after} == {
        (3, "gap"),
        (3, "prev_hash mismatch"),
    }, (
        f"removing position 2 of a three-row chain was not reported as both a "
        f"gap and a broken link: {after}"
    )
    assert surviving_states == [ENABLE_ALWAYS], (
        f"the DISABLE TRIGGER ALL outlived its rolled-back transaction: "
        f"{surviving_states}. audit_log is now mutable for the rest of the run"
    )
