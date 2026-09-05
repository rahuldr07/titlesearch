"""The audit actor is a RESOLVED seat, and what that still does not buy

---------------------------------------------------------------------------
🔴 WHY THIS FILE EXISTS: `test_audit_writer.py` SAID SO IN AS MANY WORDS.
---------------------------------------------------------------------------
That module's own "what this file does NOT prove" section:

    **the actor is who it says it is.** `app.actor_subject` is a GUC, and
    `0007`'s own comment is explicit that a role can set its own. What is proved
    here is that a change with NO actor is REFUSED, not that a declared actor is
    authentic.

It was measured on this schema rather than left as a note: a session set
`app.actor_subject` and `app.actor_seat` to a DIFFERENT user's identity, inserted
a `legal_holds` row, and the audit row attributed the mutation to the forged
user. Presence was checked. Authenticity was not, and nothing anywhere bound
either GUC to the real database principal or to a seat anybody holds.

`0100` binds them. This file is the machine for both halves of what that means:
what is now REFUSED (§1-§3) and what is still POSSIBLE (§4), because a control
that is described as more than it is, is worse than one described as less.

## §4 IS NOT A TODO. IT IS AN ASSERTION THAT THE HOLE IS STILL OPEN

`test_a_real_colleagues_identity_can_still_be_borrowed` PASSES when the forgery
SUCCEEDS. It is written that way deliberately. Every browser session in this
system arrives on one shared login role, `titlepipe_app`, so the database cannot
tell one human on that role from another and `0100` never claimed it could —
what it narrowed was the set an actor can forge into, from "any string at all"
to "this tenant's own active seat-holders". The day an identity provider signs
its assertions and `resolve_actor` verifies that signature, this test goes RED,
and going red is how it reports that the residual it names has been closed. Its
failure message says so.

## What is NOT proved here, so it is not read as covered

* **that the binder cannot be removed.** `titlepipe_owner` can `DROP TRIGGER
  audit_log_bind_actor`, and `titlepipe_owner` is one `SET ROLE` from
  `titlepipe_migration`, a LOGIN role. Nothing inside the database stops that.
  What notices is `tests/test_trigger_function_bodies.py`, whose expectations
  live in git;
* **that `audit_log.actor_subject` names the human at the keyboard.** See §4.

## Nothing here is skipped, and every write is rolled back

`audit_log` has no statement that empties it — `0001`'s triggers refuse DELETE
and TRUNCATE to the superuser as readily as to anyone else — so every test runs
inside a connection it rolls back and leaves the module-scoped `migrated_database`
as it found it.
"""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError

# `invalid_authorization_specification` — what `0007` already raises for the
# ABSENT actor and what `0100` raises for the UNRESOLVABLE one. Asserted
# specifically rather than "something raised": a misspelled column is `42703`
# and a missing table `42P01`, and either would read as proof that the check
# works.
NO_ACTOR_SQLSTATE = "28000"

TENANT_GUC = "app.current_tenant"
ACTOR_SUBJECT_GUC = "app.actor_subject"
ACTOR_SEAT_GUC = "app.actor_seat"

BINDER_TRIGGER = "audit_log_bind_actor"
CHAIN_TRIGGER = "audit_log_chain_link"

# The login role every application session arrives on, and therefore the value
# `actor_principal` carries for every row an application write produces. It is
# `session_user` and not `current_user`, which is the whole reason it is worth
# recording: a `SET ROLE` moves the second and cannot move the first.
APP_PRINCIPAL = "titlepipe_app"

# Two seats, both real labels of `0020`'s `user_role` enum, held by two different
# people. §4 needs two: a forgery into an identity nobody holds is §1's case, and
# the residual this file has to keep visible is a forgery into somebody who does.
ADA_SUBJECT = "ada@titlepipe.example"
ADA_SEAT = "reviewer"
BO_SUBJECT = "bo@titlepipe.example"
BO_SEAT = "senior"

INSERT_HOLD = (
    "INSERT INTO legal_holds ("
    "  tenant_id, subject_table, subject_id, matter_reference, reason, placed_by"
    ") VALUES (:tenant, 'orders', :subject, 'MATTER-1', 'test fixture', :actor)"
    " RETURNING id"
)


def _sqlstate(error: DBAPIError) -> str | None:
    """The five-character SQLSTATE psycopg attached, if it attached one.

    `isinstance` rather than a bare `getattr`, which is the guard the rest of
    this suite uses: `getattr` on a DBAPI exception returns whatever is there,
    and a comparison of `Any` against a string passes for `None` as readily as
    for a code.
    """
    sqlstate = getattr(error.orig, "sqlstate", None)
    return sqlstate if isinstance(sqlstate, str) else None


def _declare(connection: Connection, **gucs: str) -> None:
    """`set_config(..., is_local => true)` for each GUC named."""
    for name, value in gucs.items():
        connection.execute(
            text("SELECT set_config(:name, :value, true)"), {"name": name, "value": value}
        )


def _seat(
    connection: Connection,
    tenant: UUID,
    subject: str,
    role: str,
    *,
    deactivated: bool = False,
) -> UUID:
    """One `users` row — a person who exists, holding one seat.

    `deactivated` writes `deactivated_at` rather than deleting anything, because
    that is how `0020` retires a seat: "a deleted user row is a record that an
    audit row then names nobody for". §2 needs a retired seat that is still
    present in the table, which is the case a `NOT EXISTS` check would miss.
    """
    return connection.execute(
        text(
            "INSERT INTO users ("
            "  tenant_id, email, role, identity_provider, identity_subject,"
            "  deactivated_at"
            ") VALUES ("
            "  :tenant, :email, :role, 'test-fixture', :subject,"
            "  CASE WHEN :deactivated THEN now() ELSE NULL END"
            ") RETURNING id"
        ),
        {
            "tenant": tenant,
            # Lower-case because `ck_users_email_is_lowercase` refuses anything
            # else, and derived from the subject so the two cannot drift.
            "email": subject.lower(),
            "role": role,
            "subject": subject,
            "deactivated": deactivated,
        },
    ).scalar_one()


def _as_app(connection: Connection, tenant: UUID, subject: str, seat: str) -> None:
    """The session context an authenticated request carries: tenant, then actor."""
    _declare(
        connection,
        **{TENANT_GUC: str(tenant), ACTOR_SUBJECT_GUC: subject, ACTOR_SEAT_GUC: seat},
    )


def _place_hold(connection: Connection, tenant: UUID, actor: str) -> UUID:
    """One `legal_holds` row, which the audit writer records behind it."""
    return connection.execute(
        text(INSERT_HOLD), {"tenant": tenant, "subject": uuid4(), "actor": actor}
    ).scalar_one()


def _audit_row(connection: Connection, subject: UUID) -> dict[str, object]:
    """The single audit row naming `subject`. Raises if there is not exactly one."""
    rows = [
        dict(row)
        for row in connection.execute(
            text(
                "SELECT actor_subject, actor_seat, actor_user_id, actor_principal,"
                "       row_hash, prev_hash, chain_position, tenant_id"
                "  FROM audit_log WHERE subject_id = :subject"
            ),
            {"subject": subject},
        ).mappings()
    ]
    assert len(rows) == 1, f"expected exactly one audit row for {subject}, got {len(rows)}"
    return rows[0]


# --- 1. an actor who is not a person is refused -----------------------------


@pytest.mark.parametrize(
    ("subject", "seat", "fragment"),
    [
        # 🔴 THE EXACT STRING FROM THE FINDING THIS FILE EXISTS FOR. A backfill
        # job named itself and the database recorded it as a person.
        ("accuracy-backfill", ADA_SEAT, "is not an active seat of tenant"),
        ("TEST-ONLY", ADA_SEAT, "is not an active seat of tenant"),
        # Present in the tenant, holding a DIFFERENT seat. The subject resolves;
        # the seat does not, and the seat is what every authorization decision
        # in this system reads.
        (ADA_SUBJECT, BO_SEAT, "holds seat"),
        # Neither half omitted, both blank — `0007`'s presence check, which
        # `resolve_actor` subsumes rather than duplicates.
        ("", ADA_SEAT, "no actor is established"),
        (ADA_SUBJECT, "", "no actor is established"),
    ],
)
def test_an_actor_who_is_not_an_active_seat_of_this_tenant_is_refused(
    subject: str,
    seat: str,
    fragment: str,
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """The write is REFUSED — not recorded under a name nobody answers to.

    The refusal is on the WRITE to `legal_holds`, which is the property worth
    having: there is no path that mutates an audited table and files an audit row
    naming a fiction, because the change itself does not happen.

    The message fragment is asserted alongside the SQLSTATE because `28000` now
    has three producers inside `resolve_actor` — absent, unresolvable and
    wrong-seat — and a test that accepted any of them would pass against a
    function that had lost two of the three checks.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            _seat(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            _declare(connection, **{ACTOR_SUBJECT_GUC: subject, ACTOR_SEAT_GUC: seat})

            with pytest.raises(DBAPIError) as raised:
                _place_hold(connection, tenant, subject)
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == NO_ACTOR_SQLSTATE, (
        f"actor {subject!r} seat {seat!r} was refused with "
        f"{_sqlstate(raised.value)!r} rather than {NO_ACTOR_SQLSTATE!r}. A "
        f"different code means something other than the actor gate answered, and "
        f"no code at all means the write was ACCEPTED: {raised.value}"
    )
    assert fragment in str(raised.value), (
        f"the refusal came back for a reason other than the one this case "
        f"exercises — {fragment!r} is not in: {raised.value}"
    )


def test_a_retired_seat_cannot_sign(
    migrated_database: str, app_dsn: str, seam_engine: Callable[[str], Engine]
) -> None:
    """`deactivated_at` is a state, and `0100` reads it.

    A row is still THERE after a seat is retired — `0020` grants no `DELETE` on
    `users` and says why — so "the subject exists" and "the subject may sign"
    are different questions, and a resolver that asked only the first would let a
    departed employee go on making changes for as long as nobody removed a row
    that is never removed.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            _seat(connection, tenant, ADA_SUBJECT, ADA_SEAT, deactivated=True)

            with pytest.raises(DBAPIError) as raised:
                _place_hold(connection, tenant, ADA_SUBJECT)
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == NO_ACTOR_SQLSTATE, (
        f"a deactivated seat signed a change and got {_sqlstate(raised.value)!r}: {raised.value}"
    )
    assert "is not an active seat" in str(raised.value), raised.value


def test_a_session_cannot_write_an_audit_row_into_another_tenant(
    migrated_database: str, app_dsn: str, seam_engine: Callable[[str], Engine]
) -> None:
    """The tenancy claim for `audit_log`, WITH a valid actor established.

    🔴 THIS TEST MOVED HERE AND THE MOVE IS THE POINT.
    `test_tenant_isolation.py`'s cross-tenant write loop writes `tenant_id` and
    nothing else, so as of `0100` its `audit_log` case is refused by the actor
    gate — a `BEFORE` trigger, which runs before the policy's `WITH CHECK` — and
    what it proves for that one table is "no actor was declared" rather than
    anything about tenancy. `EARLIER_REFUSALS` there names this file.

    So this one establishes a REAL, ACTIVE seat of its own tenant first and then
    aims the row at another. The refusal is still `28000` and it is still the
    actor gate, but now for the reason that matters: `users` is under `FORCE ROW
    LEVEL SECURITY`, the session holds tenant A, and no seat of tenant B is
    visible to resolve against — so an actor cannot be borrowed ACROSS the tenant
    boundary even when the actor is genuine on this side of it.
    """
    tenant_a, tenant_b = uuid4(), uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant_a, ADA_SUBJECT, ADA_SEAT)
            _seat(connection, tenant_a, ADA_SUBJECT, ADA_SEAT)

            with pytest.raises(DBAPIError) as raised:
                connection.execute(
                    text(
                        "INSERT INTO audit_log ("
                        "  tenant_id, actor_subject, actor_seat, action,"
                        "  subject_table, subject_id"
                        ") VALUES (:tenant, :subject, :seat, 'insert', 'orders', :row)"
                    ),
                    {
                        "tenant": tenant_b,
                        "subject": ADA_SUBJECT,
                        "seat": ADA_SEAT,
                        "row": uuid4(),
                    },
                )
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == NO_ACTOR_SQLSTATE, (
        f"a session holding {tenant_a} wrote an audit row keyed to {tenant_b} and "
        f"got {_sqlstate(raised.value)!r}. No code at all means it was ACCEPTED: "
        f"{raised.value}"
    )
    assert "is not an active seat of tenant" in str(raised.value), raised.value


# --- 2. what the row records, and who chose it ------------------------------


def test_the_resolved_actor_and_the_login_role_are_both_recorded(
    migrated_database: str, app_dsn: str, seam_engine: Callable[[str], Engine]
) -> None:
    """The positive control: a legitimate write, and the four identity columns.

    Without this the whole file is satisfied by a database that refuses every
    write, which is the failure mode a set of refusal tests always has.

    `actor_user_id` is compared to the id `_seat` returned — the resolver's
    answer against the row it should have found — rather than to "not null".
    `actor_principal` is compared to `titlepipe_app` by literal, because the
    claim is specifically that the SERVER supplied the login role and not that
    some string is present.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            ada = _seat(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            hold = _place_hold(connection, tenant, ADA_SUBJECT)
            row = _audit_row(connection, hold)
            connection.rollback()
    finally:
        engine.dispose()

    assert row["actor_subject"] == ADA_SUBJECT, row
    assert row["actor_seat"] == ADA_SEAT, row
    assert row["actor_user_id"] == ada, (
        f"the audit row resolved to {row['actor_user_id']!r}, not to the seat "
        f"{ada!r} the subject actually names. A resolver that returned the wrong "
        f"row would still be non-null here."
    )
    assert row["actor_principal"] == APP_PRINCIPAL, (
        f"actor_principal is {row['actor_principal']!r}, not {APP_PRINCIPAL!r}. "
        f"It is `session_user`, supplied by the server; a caller-supplied value "
        f"would be whatever the caller chose."
    )


def test_a_caller_cannot_choose_its_own_actor_user_id_or_principal(
    migrated_database: str, app_dsn: str, seam_engine: Callable[[str], Engine]
) -> None:
    """Both columns are ASSIGNED, not validated, so a supplied value is discarded.

    A binder that CHECKED a caller-supplied `actor_user_id` would be satisfied by
    a caller that supplied the right one for the wrong actor. `0007` makes the
    same argument for `row_hash` — "the application can't choose either value" —
    and this is the differential that shows it holds for these two as well.

    The supplied `actor_user_id` is a fresh uuid naming no row at all and the
    supplied `actor_principal` is `titlepipe_owner`, which is the value an
    attacker would most want the record to carry instead of the truth.
    """
    tenant = uuid4()
    forged_user, forged_row = uuid4(), uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            ada = _seat(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            connection.execute(
                text(
                    "INSERT INTO audit_log ("
                    "  tenant_id, actor_subject, actor_seat, actor_user_id,"
                    "  actor_principal, action, subject_table, subject_id"
                    ") VALUES ("
                    "  :tenant, :subject, :seat, :forged_user, 'titlepipe_owner',"
                    "  'insert', 'orders', :row"
                    ")"
                ),
                {
                    "tenant": tenant,
                    "subject": ADA_SUBJECT,
                    "seat": ADA_SEAT,
                    "forged_user": forged_user,
                    "row": forged_row,
                },
            )
            row = _audit_row(connection, forged_row)
            connection.rollback()
    finally:
        engine.dispose()

    assert row["actor_user_id"] == ada, (
        f"a caller-supplied actor_user_id survived: the row carries "
        f"{row['actor_user_id']!r} and the resolver's answer is {ada!r}"
    )
    assert row["actor_user_id"] != forged_user, "the forged user id was honoured"
    assert row["actor_principal"] == APP_PRINCIPAL, (
        f"a caller-supplied actor_principal survived: {row['actor_principal']!r}"
    )


def test_the_bound_actor_columns_are_inside_the_chain_hash(
    migrated_database: str, app_dsn: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 THE TRIGGER FIRING ORDER, DRIVEN RATHER THAN READ OFF A NAME.

    Same-timing row triggers fire in ALPHABETICAL ORDER OF TRIGGER NAME.
    `audit_log_chain_link` hashes `to_jsonb(NEW)` — the row as it stands when the
    hash is taken — so `audit_log_bind_actor` firing after it would leave both of
    its columns OUTSIDE the tamper-evident hash, and every catalog assertion in
    the tree would still pass: the trigger exists, it is `BEFORE INSERT`, it is
    `FOR EACH ROW`, it is `tgenabled = 'A'`.

    `b` < `c` is what makes it right, and one letter is not a thing to leave to a
    comment. So this recomputes the hash exactly as `audit_chain_link` would have
    seen the row IF THE BINDER HAD NOT RUN YET — the two actor columns set back
    to JSON null, which is what `to_jsonb(NEW)` renders for a column no trigger
    has assigned — and asserts the stored hash is NOT that.

    🔴 JSON `null` AND NOT THE KEYS REMOVED, WHICH IS THE DIFFERENCE BETWEEN A
    TEST THAT DETECTS THIS AND ONE THAT DOES NOT. MEASURED: with the keys
    deleted the recomputation differs from the stored hash under BOTH orders, so
    the assertion holds vacuously and a binder renamed to sort after
    `audit_log_chain_link` goes green. The columns are `NOT NULL` and exist on
    the row whatever fired; only their VALUES depend on the order. `row_hash` is
    nulled the same way for the same reason — `audit_chain_link` sets it to NULL
    before hashing itself.

    The recomputation is done in SQL rather than in Python because the input is
    `to_jsonb(NEW)::text` and PostgreSQL's jsonb text rendering — key order,
    numeric and timestamp spelling — is not something a Python `json.dumps`
    reproduces. Only the SUBTRACTION of the two keys is ours.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            _seat(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            hold = _place_hold(connection, tenant, ADA_SUBJECT)

            stored, without_actor = connection.execute(
                text(
                    "SELECT a.row_hash,"
                    "       sha256("
                    "         coalesce(a.prev_hash, ''::bytea)"
                    "         || convert_to("
                    "              (to_jsonb(a) || jsonb_build_object("
                    "                  'row_hash', NULL::text,"
                    "                  'actor_user_id', NULL::text,"
                    "                  'actor_principal', NULL::text))::text,"
                    "              'UTF8')"
                    "       )"
                    "  FROM audit_log a WHERE a.subject_id = :subject"
                ),
                {"subject": hold},
            ).one()
            connection.rollback()
    finally:
        engine.dispose()

    assert stored != without_actor, (
        "audit_log.row_hash equals the hash of the row WITHOUT actor_user_id and "
        "actor_principal, which means audit_log_bind_actor fired AFTER "
        f"{CHAIN_TRIGGER} and both columns are outside the chain. Trigger firing "
        f"order is alphabetical by name: {BINDER_TRIGGER!r} has to sort before "
        f"{CHAIN_TRIGGER!r}."
    )


# --- 3. the ceiling, asserted rather than described --------------------------


def test_a_real_colleagues_identity_can_still_be_borrowed(
    migrated_database: str, app_dsn: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 THIS TEST PASSES WHEN THE FORGERY SUCCEEDS, AND THAT IS DELIBERATE.

    `0100`'s docstring says the actor is now REAL and still not AUTHENTIC. This
    is that sentence as a machine. Ada's session — one shared `titlepipe_app`
    login, like every session in this system — declares Bo's subject and Bo's
    seat, places a legal hold, and the audit row names Bo.

    The database cannot refuse this and does not pretend to: `titlepipe_app` is
    one role for every human, so there is nothing in the connection that
    distinguishes Ada's request from Bo's. What `0100` bought is the SIZE of the
    set — §1 is the proof that the forgery must now name somebody who exists,
    is active, is in this tenant, and holds exactly the seat claimed.

    WHEN THIS TEST GOES RED, READ THE CHANGE AND THEN DELETE IT. Red here means
    the residual it names has been closed — the identity provider signs a
    short-lived assertion over (tenant, subject, seat, expiry) with a key
    `titlepipe_app` does not hold and `resolve_actor` verifies it. That is the
    only thing that closes it, and it is a good day.
    """
    tenant = uuid4()
    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            _as_app(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            _seat(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            bo = _seat(connection, tenant, BO_SUBJECT, BO_SEAT)

            # Ada's session, now claiming to be Bo. Nothing about the connection
            # changed; two `set_config` calls did.
            _declare(
                connection,
                **{ACTOR_SUBJECT_GUC: BO_SUBJECT, ACTOR_SEAT_GUC: BO_SEAT},
            )
            hold = _place_hold(connection, tenant, BO_SUBJECT)
            row = _audit_row(connection, hold)
            connection.rollback()
    finally:
        engine.dispose()

    borrowed = "the audit row does NOT name the borrowed identity, so this residual has "
    assert row["actor_subject"] == BO_SUBJECT, (
        borrowed
        + "been closed since the test was written — actor_subject reads "
        + repr(row["actor_subject"])
        + ". Read the note on actor_user_id below before changing anything."
    )
    assert row["actor_user_id"] == bo, (
        borrowed
        + "been closed since the test was written. Read what changed: if "
        + "resolve_actor now verifies a signed assertion from an identity "
        + "provider, delete this test and say so in 0100's docstring, which "
        + "currently states the opposite. Do not 'fix' this test to match."
    )
    assert row["actor_principal"] == APP_PRINCIPAL, (
        "actor_principal is the one column the caller could not choose, and it "
        "still reports the login role the forgery arrived on"
    )


def test_the_principal_reports_the_login_role_a_set_role_cannot_move(
    migrated_database: str,
    migration_role: str,
    role_dsn: Callable[[str, str, str], str],
    role_passwords: dict[str, str],
    seam_engine: Callable[[str], Engine],
) -> None:
    """`session_user` survives `SET ROLE titlepipe_owner`; `current_user` does not.

    This is the half of `0100` that is NOT a claim the caller makes. A mutation
    performed from a migration session while declaring an ordinary reviewer's
    identity records `titlepipe_migration` in `actor_principal`, because that is
    the role the connection AUTHENTICATED as and no `SET ROLE` reaches it.

    Visible, not prevented — the write still happens, and `0100`'s docstring says
    so. What this asserts is that the record does not read as though an
    application session made it.
    """
    tenant = uuid4()
    engine = seam_engine(
        role_dsn(migrated_database, migration_role, role_passwords[migration_role])
    )
    try:
        with engine.connect() as connection:
            connection.execute(text("SET ROLE titlepipe_owner"))
            became = connection.execute(text("SELECT current_user")).scalar_one()
            assert became == "titlepipe_owner", (
                f"SET ROLE did not take: this ran as {became!r}, so whatever the "
                f"row below carries says nothing about the escalated path"
            )

            _as_app(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            _seat(connection, tenant, ADA_SUBJECT, ADA_SEAT)
            hold = _place_hold(connection, tenant, ADA_SUBJECT)
            row = _audit_row(connection, hold)
            connection.rollback()
    finally:
        engine.dispose()

    assert row["actor_principal"] == migration_role, (
        f"actor_principal is {row['actor_principal']!r}, not {migration_role!r}. "
        f"An owner-escalated write that records itself as anything else is the "
        f"exact thing this column exists to make visible — `current_user` would "
        f"say 'titlepipe_owner' and neither would say who logged in."
    )
    assert row["actor_subject"] == ADA_SUBJECT, (
        "the declared actor is unchanged by the escalation, which is why the "
        "principal is worth recording separately"
    )
