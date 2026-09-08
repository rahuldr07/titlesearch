"""`fields` refuses half a citation — the whole-or-absent idiom applied to the pair it was written for

Revision ID: 0090
Revises: 0080
Create Date: 2026-09-05

## Assumed parent

`down_revision = "0080"` is the head this worktree found after resetting to
`integration/backend-2026-09`, and `0080`'s own header records that the `0080+`
range is for revisions written after the merge. Aryabhata is writing `0100+` in
parallel; the `0090+` range is reserved for this one. Per `CONVENTIONS.md` §8
the parent is STATED rather than reconciled here, and god linearizes.

The dependency is real and not bookkeeping: the constraint names two columns
`0032` adds to `fields`, so anything before `0032` is a `column does not exist`.

---------------------------------------------------------------------------
WHY THIS EXISTS, AND WHY THE DEADLINE IS THE EXTRACTION WORKER'S FIRST ROW.
---------------------------------------------------------------------------
A row carrying `source_page_no = 7` with `source_document_id = NULL` was written
through real RLS at head `0080` and the database accepted it. Page seven of
WHAT. That row is a value the system cannot cite while every column on it says
it can, which is CLAUDE.md's principle 6 — "never emit a value you can't cite",
recorded there as caught six times in prototyping — failing at the layer that is
supposed to be the last one to fail.

**TODAY THIS IS ONE `ALTER TABLE`.** `fields` holds no pipeline data yet. Once
the extraction worker writes, adding this constraint stops being a schema change
and becomes a data-cleanup project: `ADD CONSTRAINT` validates existing rows, so
the first half-cited row already stored turns this file into a decision about
what to do with it — repair it from the reading it adopted, blank the surviving
half, or exempt it — and none of those three is a decision a migration gets to
make on its own.

## The table already had this idiom TWICE, and not on the pair that needed it

`0032` wrote `num_nonnulls(approved_by, approved_at) IN (0, 2)` and
`num_nonnulls(excluded_reason, excluded_by, excluded_at) IN (0, 3)`, for the
reason it states about exclusion: "a half-recorded exclusion is a suppression
nobody signed". The citation pair is the same shape with a higher cost — a
half-recorded approval is an unsigned approval, and a half-recorded citation is
an uncitable value being served as a cited one — and it is the pair principle 6
is actually about. This revision applies the idiom the third time.

## `IN (0, 2)` AND NOT `= 2`, WHICH IS THE WHOLE DESIGN OF THE CONSTRAINT

Both columns NULL stays LEGAL, deliberately. `db/models/fields.py` records that
the envelope's nullability IS the product: a field whose `value` is non-null
while the envelope is null is the exact failure shape the architecture exists to
CATCH, and the server routes it to review. A `NOT NULL` — or a `= 2` here, which
is the same thing said in a check — would force the pipeline to invent a
citation to satisfy the schema, which is principle 6 inverted into a requirement
to make one up. `field_readings.line_coords` is the same trap one table down and
`0032` documents it there.

So the three shapes are: **absent** (legal, routed to review), **whole** (legal,
ordinary), **half** (refused, and there is no reading of it that is a citation —
a page with no document names nothing, a document with no page is "somewhere in
these forty pages").

## `source_snippet` and `source_line_coords` are NOT in the pair

A snippet is the excerpt shown beside the value and its absence degrades the
reader's experience, while a page reference's absence changes whether the value
is CITED. Folding the snippet in would refuse readings from engines that locate
a page and return no excerpt.

This paragraph used to cite `api/schemas/provenance.py` as stating the same
split for the WIRE. That module is deleted — it had no importers and no
endpoint served a field. `api/schemas/__init__.py` carries the residual: this
constraint holds for ROWS, and a projection that drops one half is still
unguarded.

## THE INTERACTION WITH `0032`'s `unreadable_cites_a_page`, WHICH TIGHTENS

`ck_fields_unreadable_cites_a_page` requires a page of any `PRESENT_UNREADABLE`
field — "the ink is gone on a page somebody can name". Under this revision that
requirement becomes a WHOLE citation, because a page is nameable only inside a
document. That is a real narrowing of what `fields` accepts and it is INTENDED:
before this revision, the one NA label that is supposed to be the most precisely
located of the four could be stored with a page number floating free of any
document. Nothing in the suite or the seed writes that shape, so nothing green
turns red on it; it is written down here because a reader hitting the refusal
later needs to find it stated rather than infer it from two constraints.

## NOT `NOT VALID`, and the omission is the point

`ADD CONSTRAINT` validates every existing row and takes `ACCESS EXCLUSIVE` for
the length of that scan. `NOT VALID` would skip it and make this file apply
cleanly to a table full of half-cited rows — which is precisely the deferral the
deadline above is about, and it would leave the constraint claiming a property
of the table that is false for the rows already in it. If this fails to apply on
some future database, the failure is the finding.

## No downgrade guard, and why the round trip is honest here

`downgrade()` drops the constraint and nothing else. Dropping a CHECK cannot
fail on data, leaves no type, function, sequence or index behind, and re-running
`upgrade()` afterwards revalidates the same rows — so `test_upgrade_downgrade
_upgrade_is_clean`'s whole-`public`-schema diff has nothing to catch here. That
is stated rather than assumed: it was run.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0090"
down_revision: str | None = "0080"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The SHORT name. `NAMING_CONVENTION["ck"]` contains `%(constraint_name)s` and
# therefore WRAPS whatever it is given, on the drop as well as on the create, so
# the live constraint is `ck_fields_citation_is_whole` and both calls below name
# it `citation_is_whole`. `0032`'s `downgrade()` docstring records the same trap
# — a unique constraint in that same file is dropped by its FULL name, because
# the `uq` pattern does not wrap.
CONSTRAINT_NAME = "citation_is_whole"

# Spelled `IN (0, 2)` to match the two constraints `0032` already wrote on this
# table. PostgreSQL normalises it to `= ANY (ARRAY[0, 2])` in the catalog, which
# is how `\d fields` renders all three of them and is why they read alike there.
CITATION_IS_WHOLE = "num_nonnulls(source_document_id, source_page_no) IN (0, 2)"


def upgrade() -> None:
    op.create_check_constraint(CONSTRAINT_NAME, "fields", CITATION_IS_WHOLE)


def downgrade() -> None:
    """Reverse of `upgrade`. One statement, because `upgrade` was one statement."""
    op.drop_constraint(CONSTRAINT_NAME, "fields", type_="check")
