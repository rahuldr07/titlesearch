"""Ground truth is established from the senior, engineer and admin seats only

Revision ID: 0121
Revises: 0120

## The ruling this closes

`0102` refused a signature that names no active person, and its docstring named
the remaining question OPEN on purpose: WHICH seats may establish ground truth
is a product ruling, "not a migration's to invent". The owner ruled on
2026-09-08: SENIOR, ENGINEER and ADMIN. Not reviewer, not ops, not typist.

Measured at `0120`, immediately before this revision: an INSERT into
`golden_fields` signed from a reviewer seat was ACCEPTED — the six-case test in
`tests/test_golden_set.py` went red on exactly that before this file existed.
All six labels could sign, and `0102` said so out loud.

## The machine is the one predicate `0102` reserved space for

`signer_body()` already resolved the signer's current seat into `seat` and did
nothing with it beyond handing it back to `resolve_actor`. This revision adds
the predicate that reads it: a seat outside the ruled three raises `42501`
(`insufficient_privilege`), which is deliberately NOT `0102`'s `28000` — the
person EXISTS, is ACTIVE and is IN TENANT; what is missing is authority, not
identity. A message that says which seats may sign, so an operator reading the
refusal learns the rule rather than that a constraint fired.

The predicate sits AFTER the `PERFORM resolve_actor` call, and the order is
load-bearing: the ambiguous case — two identity providers minting one subject —
must keep `0102`'s refusal from the resolver, not be answered by a seat
predicate reading whichever row the unqualified `SELECT INTO` happened to pick.

The function stays GENERIC OVER THE SIGNED COLUMN (`to_jsonb(NEW) ->>
TG_ARGV[0]`), so the one body still serves `golden_fields.established_by` and
`golden_corrections.signed_by`, and a third signed column remains one `CREATE
TRIGGER` rather than a third body.

## Replaced by DROP and CREATE, not `CREATE OR REPLACE`

`0001`'s guard, unchanged: with `OR REPLACE`, a `downgrade()` that forgot its
restore would be silently overwritten by the next upgrade instead of failing.
Both triggers are dropped first — a function with dependent triggers refuses a
plain `DROP` — and recreated `ENABLE ALWAYS`, read back, exactly as `0102` left
them. The recreated function repeats `0102`'s `REVOKE EXECUTE ... FROM PUBLIC`:
`tests/acl_contract.py`'s closed-world snapshot holds the schema to no
non-owner ACL entry here, and a fresh `CREATE FUNCTION` would otherwise arrive
with the default PUBLIC grant.

`downgrade()` restores `0102`'s body CHARACTER FOR CHARACTER:
`previous_signer_body()` below is a frozen copy of `0102::signer_body()`'s
output, and `tests/test_trigger_function_bodies.py` pins the two strings equal
— so "restored exactly" is asserted from git rather than trusted to a paste.

## THE CEILING

Unchanged from `0102`: `titlepipe_owner` can replace the function and no
statement it issues will fail. The body at head is compared to THIS file's
`signer_body()` by `tests/test_trigger_function_bodies.py`, which is the
detection leg; it is not prevention.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0121"
down_revision: str | None = "0120"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 🔴 THE RULING OF 2026-09-08, AS A TUPLE, AND THIS IS ITS ONE HOME IN THE
# MIGRATION. A strict subset of `0020`'s six labels, in `0020`'s order. The
# six-case test in `tests/test_golden_set.py` deliberately does NOT read this
# constant — it states all six verdicts as literals, so an edit here is a red
# there rather than a rule that follows its own implementation.
GROUND_TRUTH_SEATS = ("senior", "engineer", "admin")

SIGNED_COLUMNS = (
    ("golden_fields", "established_by", "golden_fields_signer_is_a_person"),
    ("golden_corrections", "signed_by", "golden_corrections_signer_is_a_person"),
)

SIGNER_FUNCTION = "golden_signer_is_a_person"

RESOLVER_FUNCTION = "resolve_actor"

NO_ACTOR_SQLSTATE = "28000"

# `insufficient_privilege`, and not `0102`'s `28000`, because the two refusals
# answer different questions: `28000` says the database cannot find the person;
# `42501` says it found them and their seat lacks the authority.
UNRULED_SEAT_SQLSTATE = "42501"

TRIGGER_ALWAYS = "A"

# `'senior', 'engineer', 'admin'` for the predicate; "senior, engineer or admin"
# for the sentence an operator reads. Both derive from the tuple above so the
# rule, the machine and the message cannot disagree.
_SEAT_SQL_LIST = ", ".join(f"'{seat}'" for seat in GROUND_TRUTH_SEATS)
_SEAT_PROSE = f"{', '.join(GROUND_TRUTH_SEATS[:-1])} or {GROUND_TRUTH_SEATS[-1]}"


def signer_body() -> str:
    """`0102::signer_body()` plus the seat predicate, exposed for `pg_proc` comparison.

    Everything above the predicate is `0102`'s text unchanged, including the
    reasoning it carries; see that revision for why the check is `AFTER`, why
    the jsonb round trip is safe here, and what the resolver call still buys.
    """
    return f"""
        DECLARE
            signer text;
            seat text;
        BEGIN
            signer := to_jsonb(NEW) ->> TG_ARGV[0];

            SELECT u.role::text INTO seat
            FROM users u
            WHERE u.tenant_id = NEW.tenant_id
              AND u.identity_subject = signer
              AND u.deactivated_at IS NULL;

            IF seat IS NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NO_ACTOR_SQLSTATE}',
                    MESSAGE = TG_TABLE_NAME || '.' || TG_ARGV[0] || ' is '
                              || coalesce(quote_literal(signer), 'null')
                              || ', which is not an active seat of this tenant',
                    HINT = 'Ground truth is signed by a person. A job name, a '
                           'service account or a team is not one, and an engine '
                           'reading promoted under such a name is a truth this '
                           'system would then score that engine against.';
            END IF;

            -- The signer resolves. Hand it to `0100`'s resolver anyway, with the
            -- seat just read, so that the ambiguous case — two identity
            -- providers minting one subject — is refused HERE by the same
            -- function and the same message that refuses it on `audit_log`,
            -- rather than by a second implementation that could drift.
            PERFORM {RESOLVER_FUNCTION}(NEW.tenant_id, signer, seat);

            -- After the resolver, so the ambiguous subject keeps the resolver's
            -- refusal instead of a seat verdict read off an arbitrary row.
            IF seat NOT IN ({_SEAT_SQL_LIST}) THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{UNRULED_SEAT_SQLSTATE}',
                    MESSAGE = TG_TABLE_NAME || '.' || TG_ARGV[0] || ' is signed from the '
                              || quote_literal(seat)
                              || ' seat, and ground truth is established only by the '
                              || '{_SEAT_PROSE} seats',
                    HINT = 'The signer is a real, active seat of this tenant; what '
                           'is missing is authority, not identity. Ruled '
                           '2026-09-08: establishing or correcting ground truth '
                           'is restricted to {_SEAT_PROSE} (revision 0121).';
            END IF;

            RETURN NEW;
        END;
    """


def previous_signer_body() -> str:
    """`0102::signer_body()`'s output, frozen here so `downgrade()` restores it exactly.

    A COPY AND NOT AN IMPORT, for the frozen-snapshot reason every revision in
    this tree gives — and the copy is not trusted either:
    `tests/test_trigger_function_bodies.py` asserts this string equal to the one
    `0102` builds, character for character.
    """
    return f"""
        DECLARE
            signer text;
            seat text;
        BEGIN
            signer := to_jsonb(NEW) ->> TG_ARGV[0];

            SELECT u.role::text INTO seat
            FROM users u
            WHERE u.tenant_id = NEW.tenant_id
              AND u.identity_subject = signer
              AND u.deactivated_at IS NULL;

            IF seat IS NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NO_ACTOR_SQLSTATE}',
                    MESSAGE = TG_TABLE_NAME || '.' || TG_ARGV[0] || ' is '
                              || coalesce(quote_literal(signer), 'null')
                              || ', which is not an active seat of this tenant',
                    HINT = 'Ground truth is signed by a person. A job name, a '
                           'service account or a team is not one, and an engine '
                           'reading promoted under such a name is a truth this '
                           'system would then score that engine against.';
            END IF;

            -- The signer resolves. Hand it to `0100`'s resolver anyway, with the
            -- seat just read, so that the ambiguous case — two identity
            -- providers minting one subject — is refused HERE by the same
            -- function and the same message that refuses it on `audit_log`,
            -- rather than by a second implementation that could drift.
            PERFORM {RESOLVER_FUNCTION}(NEW.tenant_id, signer, seat);

            RETURN NEW;
        END;
    """


def _swap_signer_function(body: str) -> None:
    """Drop both triggers and the function, recreate all three around `body`.

    The trigger drops come first because a plain `DROP FUNCTION` refuses while
    triggers depend on it, and the recreation repeats `0102`'s three decisions —
    plain `CREATE FUNCTION`, `REVOKE ... FROM PUBLIC`, `ENABLE ALWAYS` — so both
    directions land in the state `0102` defined, differing only in the body.
    """
    for table, _column, trigger in SIGNED_COLUMNS:
        op.execute(f"DROP TRIGGER {trigger} ON {table}")
    op.execute(f"DROP FUNCTION {SIGNER_FUNCTION}()")

    op.execute(
        f"""
        CREATE FUNCTION {SIGNER_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $${body}$$
        """
    )
    op.execute(f"REVOKE EXECUTE ON FUNCTION {SIGNER_FUNCTION}() FROM PUBLIC")

    for table, column, trigger in SIGNED_COLUMNS:
        op.execute(
            f"""
            CREATE TRIGGER {trigger}
            AFTER INSERT OR UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION {SIGNER_FUNCTION}('{column}')
            """
        )
        op.execute(f"ALTER TABLE {table} ENABLE ALWAYS TRIGGER {trigger}")

    _require_trigger_state()


def upgrade() -> None:
    _swap_signer_function(signer_body())


def downgrade() -> None:
    _swap_signer_function(previous_signer_body())


def _require_trigger_state() -> None:
    """Read `tgenabled` back, and refuse unless BOTH triggers are at `'A'`."""
    rows = (
        op.get_bind()
        .exec_driver_sql(
            """
            SELECT t.tgname, t.tgenabled
            FROM pg_trigger t
            WHERE NOT t.tgisinternal AND t.tgname = ANY(%(names)s)
            """,
            {"names": [trigger for _table, _column, trigger in SIGNED_COLUMNS]},
        )
        .fetchall()
    )

    states = {str(name): str(enabled) for name, enabled in rows}
    expected = {trigger: TRIGGER_ALWAYS for _table, _column, trigger in SIGNED_COLUMNS}
    if states != expected:
        raise RuntimeError(
            f"the golden signer triggers are {states}, not {expected}. ENABLE "
            f"ALWAYS is what keeps them firing under session_replication_role = "
            f"'replica', where a plain ENABLE trigger is off for the whole "
            f"session without any statement having turned it off."
        )
