<%text>"""</%text>${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

Revision ids in this repository are hand-written decimal strings — `"0001"`,
`"0002"`, … — so the next migration's `down_revision` is readable rather than
looked up. Alembic generates a hash; replace it.

Hand-write the body. `--autogenerate` cannot see policies, grants, roles,
triggers, or the `DROP TYPE` that a `DROP TABLE` does not perform.

`downgrade()` must undo EVERY object `upgrade()` created, types and triggers
included. The test that catches an omission is
`test_upgrade_downgrade_upgrade_is_clean` in `tests/test_schema_migration.py`,
and it catches it on the SECOND upgrade, with `already exists`.
<%text>"""</%text>

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}
revision: str = ${repr(up_revision)}
down_revision: str | None = ${repr(down_revision)}
branch_labels: str | Sequence[str] | None = ${repr(branch_labels)}
depends_on: str | Sequence[str] | None = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
