"""`titlepipe_app` loses table-wide UPDATE on `users`, so a seat cannot promote itself

Revision ID: 0120
Revises: 0102

THE APP ROLE COULD REWRITE `users.role` WITHIN ITS OWN TENANT. MEASURED.
Against postgres:18.4 at revision `0102`, as `titlepipe_app` with the tenant GUC
set to the row's tenant:

    UPDATE users SET role = 'admin' WHERE id = <the caller's own row>;
    -- UPDATE 1

`0020` wrote `GRANT SELECT, INSERT, UPDATE ON users TO titlepipe_app` — the
ordinary three verbs every tenant table gets — and nothing narrowed it
afterwards. `tenant_isolation` is not a defence here and was never meant to be:
the row a seat wants to promote is its OWN, so it is inside the policy. RLS
answers "whose rows may this session touch"; it has no opinion about which
COLUMN of a permitted row is being written.

That makes the whole authentication seam decorative on its most important claim.
`auth/dependencies.require_seat` ends `return seat` with the comment
"`seat.role` AND NOT ANYTHING THE REQUEST SAID", and `auth/mock.py` and
`auth/workos_provider.py` both throw provider role claims away so that the
`users` row is the only authority. All of that is true and none of it matters if
a request can write the row it is about to be judged by. The role stopped coming
off the wire and started coming out of a table the wire could edit.

## The narrowing, and why it is the same shape `fields` got

`0032::_narrow_the_update_grant` did this first, for the same reason and with the
same three lines: `REVOKE UPDATE ON <table> FROM titlepipe_app` and then
`GRANT UPDATE (<columns>) ON <table>`. The revoke is table-wide and comes FIRST,
because a column grant is ADDED to a table grant rather than shadowing it —
leaving the table grant in place would leave `role` writable and this revision
decorative in exactly the way it is fixing.

`fields` got that treatment on 2026-09-05 and `users` did not, though `users` is
the table the authorization decision is READ from. There was no ruling behind
the difference; there was default membership in `0002`'s list of tenant tables.

## What stays writable, and what each refusal is protecting

TWO COLUMNS: `email` and `deactivated_at`.

* `email` — a person changes their address at the provider and the row has to
  follow. Safe because email authenticates nothing: `directory.seat_key` finds a
  seat by `(identity_provider, identity_subject, organization)` and never by
  address, which is stated at `ProviderIdentity.email`. The
  `ck_users_email_is_lowercase` CHECK still governs the value;
* `deactivated_at` — `0020` records that "a seat is retired by writing
  `deactivated_at`", which is the only seat-lifecycle write this system has. A
  narrowing that took it away would make that sentence false and leave no way to
  retire anybody.

SIX WITHHELD, each a different refusal:

* `role` — THE ESCALATION THIS REVISION EXISTS FOR. See the measurement above;
* `identity_provider` and `identity_subject` — the same escalation through a door
  that never touches `role`. Repoint an ordinary seat's subject at the admin's
  WorkOS user id and the next sign-in by that admin resolves to a row of the
  attacker's choosing. `uq_users_tenant_id_identity_provider_identity_subject`
  does not help: it refuses a DUPLICATE pair, not a stolen one;
* `tenant_id` — `0002` writes no `WITH CHECK`, so the read predicate is reused
  for writes and a role that could re-tenant a row could then read it. This is
  `0032`'s reason for withholding the same column on `fields`, unchanged;
* `id` and `created_at` — insert-only, by `0020`'s server defaults.

## RESIDUAL: THERE IS NOW NO WAY TO CHANGE A ROLE AT ALL, AND THAT IS THE
   HONEST STATE RATHER THAN A GAP THIS REVISION SHOULD HAVE FILLED.

Nothing in this service writes `users` today — there is no ORM model for it and
no router that provisions a seat — so this revision changes no behaviour and
breaks no path. When a role change is wanted it is a domain question with an
answer ("who may promote whom, and what records that they did"), and it arrives
the way `fields.state` did: a `SECURITY DEFINER` function that takes the actor,
refuses the self-promotion case, and writes an `audit_log` row — beside its own
refusal test, not ahead of it. Handing back a table grant would answer the
question by accident, which is how this one was answered the first time.

## THE CEILING

`titlepipe_owner` can `GRANT UPDATE ON users TO titlepipe_app` and undo this in
one statement, exactly as it can for every other control in this schema. What
stops that being silent is
`tests/test_forced_rls_and_grants.py::test_the_narrowed_update_grant_is_exactly
_the_named_columns` and `tests/acl_contract.py`'s whole-catalog literal, which
fails on a restored table grant because a column grant is added to it rather than
replaced by it. That is detection, not prevention.

RELINKED AT INTEGRATION, 2026-09-08: `down_revision` was `0102` - the head this file's author
found - and is now `0112`, the last of the schema revisions that landed in parallel. Placement
is for a single head, not a dependency.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0120"
down_revision: str | None = "0112"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "users"

# The two the app writes. See the module docstring for what each of the six
# absent ones is protecting; `role` is the whole reason this revision exists.
USERS_APP_UPDATABLE_COLUMNS = (
    "email",
    "deactivated_at",
)

# ASSERTED, NOT ASSUMED. `role` is named here rather than derived as "the rest
# of the table" so that the read-back below fails loudly if a later revision ever
# adds it back, instead of the withheld set quietly shrinking to nothing.
USERS_APP_REFUSED_COLUMNS = (
    "role",
    "identity_provider",
    "identity_subject",
    "tenant_id",
    "id",
    "created_at",
)

APP_ROLE = "titlepipe_app"


def _verify(expected_writable: Sequence[str], expected_refused: Sequence[str]) -> None:
    """Read the column ACL back, both directions, or fail the migration.

    `0060::_verify_grants`' reason, which applies with more force here: PostgreSQL
    reports a `GRANT` issued by a role holding no grant option as a WARNING, so a
    revision whose `GRANT` did nothing exits 0. On `0060` that produced a worker
    that failed every job; here it would produce a `users` table with NO app
    UPDATE at all — the revoke lands, the grant does not — and the first symptom
    is `42501` from a seat-retirement path nobody has written yet.

    BOTH DIRECTIONS, because a revision that revoked everything and granted
    nothing satisfies the refusal half on its own.

    `has_column_privilege` and not `has_table_privilege`: the latter answers about
    the TABLE and returns false for a role holding only column grants, so it
    cannot tell this revision's outcome from a total revoke.
    """
    bind = op.get_bind()
    wrong: list[str] = []

    for column in expected_writable:
        held = bind.execute(
            sa.text("SELECT has_column_privilege(:role, :table, :column, 'UPDATE')"),
            {"role": APP_ROLE, "table": TABLE, "column": column},
        ).scalar_one()
        if not held:
            wrong.append(f"{APP_ROLE} cannot UPDATE {TABLE}.{column} and must be able to")

    for column in expected_refused:
        held = bind.execute(
            sa.text("SELECT has_column_privilege(:role, :table, :column, 'UPDATE')"),
            {"role": APP_ROLE, "table": TABLE, "column": column},
        ).scalar_one()
        if held:
            wrong.append(f"{APP_ROLE} can UPDATE {TABLE}.{column} and must not")

    if wrong:
        listed = "\n  ".join(wrong)
        raise RuntimeError(
            f"revision {revision} left the UPDATE surface on {TABLE} in a state it "
            f"did not intend:\n  {listed}\n"
            f"A GRANT from a role with no grant option is a WARNING rather than an "
            f"error, so this would otherwise have exited 0."
        )


def upgrade() -> None:
    # THE REVOKE FIRST AND TABLE-WIDE. `0032` states the mechanism: a column
    # grant is ADDED to a table grant, so granting the two columns while the
    # table grant stands would change nothing and `role` would stay writable.
    op.execute(f"REVOKE UPDATE ON {TABLE} FROM {APP_ROLE}")
    columns = ", ".join(USERS_APP_UPDATABLE_COLUMNS)
    op.execute(f"GRANT UPDATE ({columns}) ON {TABLE} TO {APP_ROLE}")

    _verify(USERS_APP_UPDATABLE_COLUMNS, USERS_APP_REFUSED_COLUMNS)


def downgrade() -> None:
    # The column grants have to go before the table grant returns, for the same
    # reason the upgrade revokes first: leaving them in place would put both
    # forms in `relacl`/`attacl` at once, and the round-trip test would find a
    # catalog `0102` never produced.
    columns = ", ".join(USERS_APP_UPDATABLE_COLUMNS)
    op.execute(f"REVOKE UPDATE ({columns}) ON {TABLE} FROM {APP_ROLE}")
    op.execute(f"GRANT UPDATE ON {TABLE} TO {APP_ROLE}")

    # The state `0020` left, asserted rather than assumed: every column writable
    # again, including the six this revision withheld.
    _verify(USERS_APP_UPDATABLE_COLUMNS + USERS_APP_REFUSED_COLUMNS, ())
