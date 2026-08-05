"""Revision scripts.

This file exists for ruff's `INP001`, which reports any `.py` file in a
directory without an `__init__.py` as an implicit namespace package.
`migrations/__init__.py` does not cover this directory — the rule looks at the
file's own parent.

Alembic ignores it: `_only_source_rev_file` in `alembic/script/base.py` is
`(?!\\.\\#|__init__)(.*\\.py)$`, so `__init__.py` is excluded from revision
discovery by name and is never loaded as a revision.

Nothing may be imported from here, and revision scripts must not import each
other. Each is a frozen snapshot of one schema change.
"""

__all__: list[str] = []
